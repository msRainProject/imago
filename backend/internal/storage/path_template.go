package storage

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

// templateVar is the named identifier of a magic variable used inside a
// {var} placeholder. Keeping the set closed prevents typos in config files
// from silently becoming filename fragments.
type templateVar string

const (
	varYear      templateVar = "year"
	varMonth     templateVar = "month"
	varDay       templateVar = "day"
	varTimestamp templateVar = "timestamp"
	varHash      templateVar = "hash"
	varHash12    templateVar = "hash12"
	varRandom    templateVar = "random"
	varExt       templateVar = "ext"
	varOriginal  templateVar = "original"
)

// supportedVars is the explicit allow-list. Adding a new magic variable is
// a deliberate, reviewed change — renderPathTemplate refuses anything not on
// the list.
var supportedVars = map[templateVar]struct{}{
	varYear: {}, varMonth: {}, varDay: {}, varTimestamp: {},
	varHash: {}, varHash12: {}, varRandom: {}, varExt: {}, varOriginal: {},
}

// templateSegment is a piece of the parsed template: either a literal run of
// characters, or a {var} placeholder.
type templateSegment struct {
	literal  string
	variable templateVar
	isVar    bool
}

// parsePathTemplate splits a template like "{year}/{month}/{hash12}{ext}"
// into its literal and variable segments.
func parsePathTemplate(template string) ([]templateSegment, error) {
	if strings.TrimSpace(template) == "" {
		return nil, errors.New("template is empty")
	}
	segments := make([]templateSegment, 0, 4)
	for i := 0; i < len(template); {
		switch template[i] {
		case '{':
			end := strings.IndexByte(template[i+1:], '}')
			if end < 0 {
				return nil, fmt.Errorf("unterminated placeholder at offset %d", i)
			}
			name := strings.TrimSpace(template[i+1 : i+1+end])
			if name == "" {
				return nil, fmt.Errorf("empty placeholder at offset %d", i)
			}
			v := templateVar(name)
			if _, ok := supportedVars[v]; !ok {
				return nil, fmt.Errorf("unsupported template variable %q (supported: %s)",
					name, supportedVarList())
			}
			segments = append(segments, templateSegment{variable: v, isVar: true})
			i += end + 2
		case '}':
			return nil, fmt.Errorf("unmatched '}' at offset %d", i)
		default:
			start := i
			for i < len(template) && template[i] != '{' && template[i] != '}' {
				i++
			}
			segments = append(segments, templateSegment{literal: template[start:i]})
		}
	}
	return segments, nil
}

func supportedVarList() string {
	names := make([]string, 0, len(supportedVars))
	for v := range supportedVars {
		names = append(names, "{"+string(v)+"}")
	}
	return strings.Join(names, ", ")
}

// renderPathTemplate materialises a parsed template. The arguments carry
// everything the closed variable set needs: the caller's original filename
// (used for {ext} and {original}), the hex SHA-256 hash of the upload bytes,
// and the wall-clock time the template was rendered at.
//
// The returned path is a forward-slash relative key; the caller is
// responsible for joining it with the storage base. Sanitisation drops path
// separators from variable values and rejects the result outright if it
// contains traversal segments.
func renderPathTemplate(segments []templateSegment, filename, hash string, now unixTime) (string, error) {
	var b strings.Builder
	for _, seg := range segments {
		if !seg.isVar {
			b.WriteString(seg.literal)
			continue
		}
		val, err := resolveVar(seg.variable, filename, hash, now)
		if err != nil {
			return "", err
		}
		b.WriteString(sanitizeTemplateValue(string(seg.variable), val))
	}
	return sanitiseRenderedKey(b.String())
}

// resolveVar expands a single magic variable. New variables are added here
// AND to supportedVars — keeping the set closed is the whole point of the
// allow-list.
func resolveVar(v templateVar, filename, hash string, now unixTime) (string, error) {
	switch v {
	case varYear:
		return fmt.Sprintf("%04d", now.Year), nil
	case varMonth:
		return fmt.Sprintf("%02d", now.Month), nil
	case varDay:
		return fmt.Sprintf("%02d", now.Day), nil
	case varTimestamp:
		if now.Timestamp != "" {
			return now.Timestamp, nil
		}
		return fmt.Sprintf("%04d%02d%02d%02d%02d%02d",
			now.Year, now.Month, now.Day, 0, 0, 0), nil
	case varHash:
		return hash, nil
	case varHash12:
		if len(hash) < 12 {
			return "", fmt.Errorf("hash too short for {hash12} (got %d chars)", len(hash))
		}
		return hash[:12], nil
	case varRandom:
		return RandomToken(), nil
	case varExt:
		ext := filepath.Ext(filename)
		if ext == "" {
			return "", nil
		}
		return ext, nil
	case varOriginal:
		return filename, nil
	default:
		// Unreachable while supportedVars is closed over the same set.
		return "", fmt.Errorf("unsupported template variable %q", string(v))
	}
}

// NowFromTime is a small adapter for callers that already have a time.Time.
func NowFromTime(t time.Time) unixTime {
	return unixTime{
		Year:      t.Year(),
		Month:     int(t.Month()),
		Day:       t.Day(),
		Timestamp: t.UTC().Format("20060102150405"),
	}
}

// sanitizeTemplateValue strips characters that would be unsafe inside a
// filename or path segment: directory separators, "..", control bytes, and
// NULs. Whitespace is collapsed to a single underscore so a variable like
// {original} cannot smuggle spaces into the resulting key.
func sanitizeTemplateValue(name, value string) string {
	if value == "" {
		return ""
	}
	value = strings.ReplaceAll(value, "\x00", "")
	var b strings.Builder
	b.Grow(len(value))
	prevUnderscore := false
	for _, r := range value {
		switch {
		case r == '/' || r == '\\':
			b.WriteByte('_')
			prevUnderscore = false
		case r < 0x20:
			// Drop control characters entirely.
			continue
		case r == ' ' || r == '\t':
			if !prevUnderscore {
				b.WriteByte('_')
				prevUnderscore = true
			}
		default:
			b.WriteRune(r)
			prevUnderscore = false
		}
	}
	out := b.String()
	// Drop leading dots only when the entire value is dots, so that file
	// extensions like ".jpg" survive. A value like "..jpg" or "../foo"
	// is caught by the ../ strip in sanitiseRenderedKey.
	if strings.Trim(out, ".") == "" {
		out = ""
	}
	return out
}

// sanitiseRenderedKey is the second line of defence: it normalises the full
// rendered template output and refuses any key that escapes the base path.
func sanitiseRenderedKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", errors.New("rendered key is empty")
	}
	if strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, `\`) {
		return "", errors.New("rendered key must be relative")
	}
	trimmed = filepath.ToSlash(trimmed)
	// Collapse repeated separators and strip ".." path segments wherever
	// they appear. The leading "../" form (a traversal segment) is the
	// dangerous one; the bare ".." filename form (e.g. ".._etc") is
	// caught by the final filepath.Clean + prefix check.
	for strings.Contains(trimmed, "//") {
		trimmed = strings.ReplaceAll(trimmed, "//", "/")
	}
	for {
		idx := strings.Index(trimmed, "../")
		if idx < 0 {
			break
		}
		trimmed = trimmed[:idx] + trimmed[idx+3:]
	}
	trimmed = strings.Trim(trimmed, "/")
	if trimmed == "" {
		return "", errors.New("rendered key has no usable segments")
	}
	// Run filepath.Clean to collapse "../"+"x"+"../" interactions and
	// resolve ".." segments. After cleaning, the result must be a
	// relative path that does not start with "..".
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if filepath.IsAbs(cleaned) || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errors.New("rendered key escapes storage base")
	}
	return cleaned, nil
}
