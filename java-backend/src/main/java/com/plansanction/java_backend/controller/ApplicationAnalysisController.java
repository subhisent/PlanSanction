
package com.plansanction.java_backend.controller;

import java.io.IOException;
import java.util.Map;

import com.plansanction.java_backend.service.ApplicationAnalysisService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/analysis")
public class ApplicationAnalysisController {

    private final ApplicationAnalysisService analysisService;

    public ApplicationAnalysisController(
            ApplicationAnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping("/documents/{documentId}")
    public ResponseEntity<Map<String, Object>> analyzeDocument(
            @PathVariable long documentId) {

        try {
            Map<String, Object> result =
                    analysisService.analyzeDocument(documentId);

            return ResponseEntity.ok(result);

        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Document not found",
                    ex);

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    ex.getMessage(),
                    ex);

        } catch (IOException | IllegalStateException ex) {
                ex.printStackTrace();

                throw new ResponseStatusException(
                          HttpStatus.BAD_GATEWAY,
                          "Document analysis failed: " + ex.getMessage(),
                           ex);
        }
    }

            @GetMapping("/documents/{documentId}/room-dimensions")
    public ResponseEntity<Map<String, Object>> getRoomDimensions(
            @PathVariable long documentId) {

        try {
            Map<String, Object> result =
                    analysisService.getRoomDimensions(documentId);

            return ResponseEntity.ok(result);

        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Document analysis not found",
                    ex);
        }
    }

    @GetMapping("/applications/{applicationId}/report")
    public ResponseEntity<Map<String, Object>> getApplicationReport(
            @PathVariable long applicationId) {
        Map<String, Object> report =
                analysisService.getApplicationReport(applicationId);
        return ResponseEntity.ok(report);
    }

    @PostMapping("/applications/{applicationId}/re-evaluate")
    public ResponseEntity<Map<String, Object>> reevaluateApplicationRules(
            @PathVariable long applicationId) {
        analysisService.evaluateRulesWithVerifiedMeasurements(applicationId);
        Map<String, Object> updatedReport =
                analysisService.getApplicationReport(applicationId);
        return ResponseEntity.ok(updatedReport);
    }
}
