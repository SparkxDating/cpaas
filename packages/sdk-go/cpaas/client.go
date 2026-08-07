package cpaas

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	APIKey  string
	BaseURL string
	HTTP    *http.Client
}

func New(apiKey string, baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:3001"
	}
	return &Client{
		APIKey:  apiKey,
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) request(method, path string, in any, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.BaseURL+"/v1"+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", c.APIKey)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("cpaas api error: %s", string(data))
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(data, out)
}

func (c *Client) VerifySend(to, channel string) (map[string]any, error) {
	var out map[string]any
	err := c.request("POST", "/verify/send", map[string]string{"to": to, "channel": channel}, &out)
	return out, err
}

func (c *Client) VerifyCheck(id, code string) (map[string]any, error) {
	var out map[string]any
	err := c.request("POST", "/verify/check", map[string]string{"id": id, "code": code}, &out)
	return out, err
}

func (c *Client) MessagesCreate(to, body string) (map[string]any, error) {
	var out map[string]any
	err := c.request("POST", "/messages", map[string]string{"to": to, "body": body}, &out)
	return out, err
}
