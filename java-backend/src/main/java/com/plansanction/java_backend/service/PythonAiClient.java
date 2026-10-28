
package com.plansanction.java_backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;

public class PythonAiClient {

    private final RestTemplate restTemplate;

    public PythonAiClient() {
        this.restTemplate = new RestTemplate();
    }

    public Map<String, Object> analyze(Path filePath)
            throws IOException {

        if (!Files.isRegularFile(filePath)) {
            throw new IOException(
                    "File does not exist: " + filePath);
        }

        // Configure the PDF part.
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.APPLICATION_PDF);

        HttpEntity<FileSystemResource> filePart =
                new HttpEntity<>(
                        new FileSystemResource(filePath),
                        fileHeaders);

        // The field name MUST be "file", matching FastAPI.
        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();
        body.add("file", filePart);

        // Configure the complete multipart request.
        HttpHeaders requestHeaders = new HttpHeaders();
        requestHeaders.setContentType(
                MediaType.MULTIPART_FORM_DATA);

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, requestHeaders);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response =
                    restTemplate.postForObject(
                            "http://127.0.0.1:8000/analyze",
                            request,
                            Map.class);

            if (response == null) {
                throw new IllegalStateException(
                        "Python AI returned an empty response");
            }

            return response;

        } catch (HttpStatusCodeException ex) {
            throw new IllegalStateException(
                    "Python AI HTTP status: "
                            + ex.getStatusCode()
                            + "; response body: "
                            + ex.getResponseBodyAsString(),
                    ex);

        } catch (RestClientException ex) {
            throw new IllegalStateException(
                    "Python AI request failed: "
                            + ex.getMessage(),
                    ex);
        }
    }
}
