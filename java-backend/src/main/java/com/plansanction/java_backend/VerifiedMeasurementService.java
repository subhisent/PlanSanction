
package com.plansanction.java_backend;

import com.plansanction.java_backend.service.ApplicationAnalysisService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class VerifiedMeasurementService {

    private final VerifiedMeasurementRepository repository;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationAnalysisService analysisService;

    public VerifiedMeasurementService(
            VerifiedMeasurementRepository repository,
            JdbcTemplate jdbcTemplate,
            ApplicationAnalysisService analysisService) {
        this.repository = repository;
        this.jdbcTemplate = jdbcTemplate;
        this.analysisService = analysisService;
    }

    @Transactional
    public VerifiedMeasurement saveMeasurement(
            VerifiedMeasurement measurement) {

        if (measurement == null) {
            throw new IllegalArgumentException(
                    "Measurement data is required.");
        }

        if (measurement.getApplicationId() == null
                || measurement.getApplicationId() <= 0) {
            throw new IllegalArgumentException(
                    "A valid application ID is required.");
        }

        if (measurement.getDocumentId() == null
                || measurement.getDocumentId() <= 0) {
            throw new IllegalArgumentException(
                    "A valid document ID is required.");
        }

        // Referential checks
        List<Map<String, Object>> appRows = jdbcTemplate.queryForList(
                "SELECT id, status FROM applications WHERE id = ?",
                measurement.getApplicationId());
        if (appRows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Application not found with ID: " + measurement.getApplicationId());
        }

        List<Map<String, Object>> docRows = jdbcTemplate.queryForList(
                "SELECT id FROM application_documents WHERE id = ? AND application_id = ?",
                measurement.getDocumentId(), measurement.getApplicationId());
        if (docRows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Document ID " + measurement.getDocumentId() + " does not belong to Application " + measurement.getApplicationId());
        }

        if (measurement.getExtractedDataId() != null) {
            if (measurement.getExtractedDataId() <= 0) {
                throw new IllegalArgumentException(
                        "Extracted data ID must be positive.");
            }
            List<Map<String, Object>> extRows = jdbcTemplate.queryForList(
                    "SELECT id FROM extracted_data WHERE id = ? AND document_id = ?",
                    measurement.getExtractedDataId(), measurement.getDocumentId());
            if (extRows.isEmpty()) {
                throw new IllegalArgumentException(
                        "Extracted data ID " + measurement.getExtractedDataId() + " does not belong to Document " + measurement.getDocumentId());
            }
        }

        if (measurement.getOfficerId() == null
                || measurement.getOfficerId() <= 0) {
            throw new IllegalArgumentException(
                    "A valid officer ID is required.");
        }

        if (measurement.getMeasurementType() == null
                || measurement.getMeasurementType().isBlank()) {
            throw new IllegalArgumentException(
                    "Measurement type is required.");
        }

        if (measurement.getVerifiedValue1() == null
                || !Double.isFinite(measurement.getVerifiedValue1())
                || measurement.getVerifiedValue1() <= 0) {
            throw new IllegalArgumentException(
                    "The first verified value must be positive and finite.");
        }

        if (measurement.getVerifiedValue2() != null
                && (!Double.isFinite(measurement.getVerifiedValue2())
                || measurement.getVerifiedValue2() <= 0)) {
            throw new IllegalArgumentException(
                    "The second verified value must be positive and finite.");
        }

        if (measurement.getUnit() == null) {
            throw new IllegalArgumentException(
                    "A measurement unit must be selected.");
        }

        if (measurement.getVerificationStatus() == null) {
            throw new IllegalArgumentException(
                    "Verification status is required.");
        }

        if (measurement.getOriginalValue1() != null
                && !Double.isFinite(measurement.getOriginalValue1())) {
            throw new IllegalArgumentException(
                    "The original first value must be finite.");
        }

        if (measurement.getOriginalValue2() != null
                && !Double.isFinite(measurement.getOriginalValue2())) {
            throw new IllegalArgumentException(
                    "The original second value must be finite.");
        }

        if (measurement.getExtractedDataId() != null
                && measurement.getExtractedDataId() <= 0) {
            throw new IllegalArgumentException(
                    "Extracted data ID must be positive.");
        }

        if (measurement.getOfficerRemarks() != null
                && measurement.getOfficerRemarks().length() > 5000) {
            throw new IllegalArgumentException(
                    "Officer remarks cannot exceed 5000 characters.");
        }

        VerifiedMeasurement saved = repository.save(measurement);

        // Record in audit_logs
        try {
            jdbcTemplate.update("""
                INSERT INTO audit_logs (
                    user_id, user_email, action, entity_type, entity_id, details, ip_address, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                saved.getOfficerId(),
                "officer@plansanction.gov.in",
                "MEASUREMENT_VERIFIED",
                "VERIFIED_MEASUREMENT",
                saved.getId(),
                "Officer verified measurement: type=" + saved.getMeasurementType()
                + ", val1=" + saved.getVerifiedValue1()
                + (saved.getVerifiedValue2() != null ? "x" + saved.getVerifiedValue2() : "")
                + " " + saved.getUnit() + ", status=" + saved.getVerificationStatus(),
                "127.0.0.1",
                LocalDateTime.now()
            );
        } catch (Exception ex) {
            System.err.println("Could not record audit log: " + ex.getMessage());
        }

        // Auto re-evaluate statutory rules using new verified measurements
        try {
            analysisService.evaluateRulesWithVerifiedMeasurements(saved.getApplicationId());
        } catch (Exception ex) {
            System.err.println("Could not auto re-evaluate rules: " + ex.getMessage());
        }

        return saved;
    }

    @Transactional
    public List<VerifiedMeasurement> saveBatchMeasurements(
            List<VerifiedMeasurement> measurements) {

        if (measurements == null || measurements.isEmpty()) {
            return List.of();
        }

        List<VerifiedMeasurement> savedList = new java.util.ArrayList<>();
        for (VerifiedMeasurement m : measurements) {
            try {
                savedList.add(saveMeasurement(m));
            } catch (Exception ex) {
                System.err.println("Could not save batch item: " + ex.getMessage());
            }
        }

        return savedList;
    }

    @Transactional(readOnly = true)
    public List<VerifiedMeasurement> getByApplicationId(
            Long applicationId) {

        if (applicationId == null || applicationId <= 0) {
            throw new IllegalArgumentException(
                    "A valid application ID is required.");
        }

        return repository.findByApplicationId(applicationId);
    }

    @Transactional(readOnly = true)
    public List<VerifiedMeasurement> getByDocumentId(
            Long documentId) {

        if (documentId == null || documentId <= 0) {
            throw new IllegalArgumentException(
                    "A valid document ID is required.");
        }

        return repository.findByDocumentId(documentId);
    }
}
