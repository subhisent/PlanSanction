
package com.plansanction.java_backend;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "verified_measurements")
public class VerifiedMeasurement {

    public enum VerificationStatus {
        VERIFIED,
        CORRECTED
    }

    public enum MeasurementUnit {
        mm,
        cm,
        m,
        ft,
        in
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false)
    private Long applicationId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "extracted_data_id")
    private Long extractedDataId;

    @Column(name = "measurement_type", nullable = false, length = 100)
    private String measurementType;

    @Column(name = "original_value_1")
    private Double originalValue1;

    @Column(name = "original_value_2")
    private Double originalValue2;

    @Column(name = "verified_value_1", nullable = false)
    private Double verifiedValue1;

    @Column(name = "verified_value_2")
    private Double verifiedValue2;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit", nullable = false)
    private MeasurementUnit unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false)
    private VerificationStatus verificationStatus;

    @Column(name = "officer_id", nullable = false)
    private Long officerId;

    @Column(name = "officer_remarks", columnDefinition = "TEXT")
    private String officerRemarks;

    @Column(name = "verified_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime verifiedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public VerifiedMeasurement() {
    }

    public Long getId() {
        return id;
    }

    public Long getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(Long applicationId) {
        this.applicationId = applicationId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getExtractedDataId() {
        return extractedDataId;
    }

    public void setExtractedDataId(Long extractedDataId) {
        this.extractedDataId = extractedDataId;
    }

    public String getMeasurementType() {
        return measurementType;
    }

    public void setMeasurementType(String measurementType) {
        this.measurementType = measurementType;
    }

    public Double getOriginalValue1() {
        return originalValue1;
    }

    public void setOriginalValue1(Double originalValue1) {
        this.originalValue1 = originalValue1;
    }

    public Double getOriginalValue2() {
        return originalValue2;
    }

    public void setOriginalValue2(Double originalValue2) {
        this.originalValue2 = originalValue2;
    }

    public Double getVerifiedValue1() {
        return verifiedValue1;
    }

    public void setVerifiedValue1(Double verifiedValue1) {
        this.verifiedValue1 = verifiedValue1;
    }

    public Double getVerifiedValue2() {
        return verifiedValue2;
    }

    public void setVerifiedValue2(Double verifiedValue2) {
        this.verifiedValue2 = verifiedValue2;
    }

    public MeasurementUnit getUnit() {
        return unit;
    }

    public void setUnit(MeasurementUnit unit) {
        this.unit = unit;
    }

    public VerificationStatus getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(VerificationStatus verificationStatus) {
        this.verificationStatus = verificationStatus;
    }

    public Long getOfficerId() {
        return officerId;
    }

    public void setOfficerId(Long officerId) {
        this.officerId = officerId;
    }

    public String getOfficerRemarks() {
        return officerRemarks;
    }

    public void setOfficerRemarks(String officerRemarks) {
        this.officerRemarks = officerRemarks;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
