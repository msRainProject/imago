package handler

import "sync"

type thumbFlight struct {
	mu    sync.Mutex
	calls map[string]*thumbCall
}

type thumbCall struct {
	wg   sync.WaitGroup
	data []byte
	err  error
}

func newThumbFlight() *thumbFlight {
	return &thumbFlight{calls: make(map[string]*thumbCall)}
}

func (f *thumbFlight) Do(key string, fn func() ([]byte, error)) ([]byte, error) {
	f.mu.Lock()
	if call, ok := f.calls[key]; ok {
		f.mu.Unlock()
		call.wg.Wait()
		return call.data, call.err
	}

	call := &thumbCall{}
	call.wg.Add(1)
	f.calls[key] = call
	f.mu.Unlock()

	defer func() {
		f.mu.Lock()
		delete(f.calls, key)
		f.mu.Unlock()
		call.wg.Done()
	}()

	call.data, call.err = fn()
	return call.data, call.err
}
