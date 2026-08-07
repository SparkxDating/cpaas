package io.cpaas;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class CpaasClient {
  private final String apiKey;
  private final String baseUrl;
  private final HttpClient http;

  public CpaasClient(String apiKey) {
    this(apiKey, "http://localhost:3001");
  }

  public CpaasClient(String apiKey, String baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
  }

  public String post(String path, String jsonBody) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v1" + path))
        .timeout(Duration.ofSeconds(30))
        .header("Content-Type", "application/json")
        .header("X-Api-Key", apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
        .build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new RuntimeException("CPaaS API error: " + response.body());
    }
    return response.body();
  }

  public String verifySend(String to, String channel) throws Exception {
    String body = String.format("{\"to\":\"%s\",\"channel\":\"%s\"}", to, channel);
    return post("/verify/send", body);
  }

  public String messagesCreate(String to, String message) throws Exception {
    String body = String.format("{\"to\":\"%s\",\"body\":\"%s\"}", to, message);
    return post("/messages", body);
  }
}
