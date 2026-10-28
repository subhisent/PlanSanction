
package com.plansanction.java_backend;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/verified-measurements")
public class VerifiedMeasurementController {

    private final VerifiedMeasurementService measurementService;

    public VerifiedMeasurementController(
            VerifiedMeasurementService measurementService) {
        this.measurementService = measurementService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VerifiedMeasurement saveMeasurement(
            @RequestBody VerifiedMeasurement measurement) {
        return measurementService.saveMeasurement(measurement);
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public List<VerifiedMeasurement> saveBatchMeasurements(
            @RequestBody List<VerifiedMeasurement> measurements) {
        return measurementService.saveBatchMeasurements(measurements);
    }

    @GetMapping("/application/{applicationId}")
    public List<VerifiedMeasurement> getByApplication(
            @PathVariable Long applicationId) {
        return measurementService.getByApplicationId(applicationId);
    }

    @GetMapping("/document/{documentId}")
    public List<VerifiedMeasurement> getByDocument(
            @PathVariable Long documentId) {
        return measurementService.getByDocumentId(documentId);
    }
}
