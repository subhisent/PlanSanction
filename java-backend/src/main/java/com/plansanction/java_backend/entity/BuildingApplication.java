
package com.plansanction.java_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;

@Entity
@Table(name = "applications")
public class BuildingApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "applicant_id")
    private Long applicantId;

     @Column(name = "district_id")
    private Long districtId;

    @Column(name = "assigned_officer_id")
    private Long assignedOfficerId;

    @Column(name = "application_number")
    private String applicationNumber;

    @Column(name = "plot_number")
    private String plotNumber;

    @Column(name = "survey_number")
    private String surveyNumber;

    @Column(name = "plot_area")
    private Double plotArea;

    @Column(name = "road_width")
    private Double roadWidth;

    @Column(name = "building_type")
    private String buildingType;

    @Column(name = "floors")
    private Integer floors;

    @Column(name = "status")
    private String status;

    @Column(name = "officer_remarks")
    private String officerRemarks;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Transient
    private Integer complianceScore;

    public BuildingApplication() {
    }

    public Long getId() {
        return id;
    }

    public Long getApplicantId() {
        return applicantId;
    }

    public Long getAssignedOfficerId() {
        return assignedOfficerId;
    }

    public String getApplicationNumber() {
        return applicationNumber;
    }

    public String getPlotNumber() {
        return plotNumber;
    }

    public String getSurveyNumber() {
        return surveyNumber;
    }

    public Double getPlotArea() {
        return plotArea;
    }

    public String getBuildingType() {
        return buildingType;
    }

    public Integer getFloors() {
        return floors;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getOfficerRemarks() {
           return officerRemarks;
    }

    public void setOfficerRemarks(String officerRemarks) {
        this.officerRemarks = officerRemarks;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getDistrictId() {
    return districtId;
  }

    public void setDistrictId(Long districtId) {
        this.districtId = districtId;
    }

    public Double getRoadWidth() {
        return roadWidth;
    }

    public void setRoadWidth(Double roadWidth) {
        this.roadWidth = roadWidth;
    }

    public void setApplicantId(Long applicantId) {
        this.applicantId = applicantId;
    }

    public void setAssignedOfficerId(Long assignedOfficerId) {
        this.assignedOfficerId = assignedOfficerId;
    }

    public void setApplicationNumber(String applicationNumber) {
        this.applicationNumber = applicationNumber;
    }

    public void setPlotNumber(String plotNumber) {
        this.plotNumber = plotNumber;
    }

    public void setSurveyNumber(String surveyNumber) {
        this.surveyNumber = surveyNumber;
    }

    public void setPlotArea(Double plotArea) {
        this.plotArea = plotArea;
    }

    public void setBuildingType(String buildingType) {
        this.buildingType = buildingType;
    }

    public void setFloors(Integer floors) {
        this.floors = floors;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Integer getComplianceScore() {
        return complianceScore;
    }

    public void setComplianceScore(Integer complianceScore) {
        this.complianceScore = complianceScore;
    }
}
