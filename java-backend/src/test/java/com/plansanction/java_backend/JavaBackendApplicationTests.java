package com.plansanction.java_backend;

import com.plansanction.java_backend.controller.BuildingApplicationController;
import com.plansanction.java_backend.entity.BuildingApplication;
import com.plansanction.java_backend.repository.BuildingApplicationRepository;
import com.plansanction.java_backend.service.ApplicationAnalysisService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class JavaBackendApplicationTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BuildingApplicationRepository applicationRepository;

    @Autowired
    private VerifiedMeasurementRepository verifiedMeasurementRepository;

    @Autowired
    private VerifiedMeasurementService verifiedMeasurementService;

    @Autowired
    private ApplicationAnalysisService analysisService;

    @Autowired
    private BuildingApplicationController applicationController;

    @Test
    void contextLoads() {
        assertNotNull(jdbcTemplate);
        assertNotNull(userRepository);
        assertNotNull(applicationRepository);
        assertNotNull(verifiedMeasurementRepository);
        assertNotNull(verifiedMeasurementService);
        assertNotNull(analysisService);
    }

    @Test
    void testGetApplicationById() {
        BuildingApplication app = applicationRepository.findAll().stream().findFirst().orElse(null);
        assertNotNull(app, "At least one application should exist in test database");

        ResponseEntity<BuildingApplication> response = applicationController.getApplicationById(app.getId());
        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(app.getId(), response.getBody().getId());
    }

    @Test
    void testGetRoomDimensionsForDocument2() {
        Map<String, Object> result = analysisService.getRoomDimensions(2L);
        assertNotNull(result);
        assertEquals(2L, ((Number) result.get("documentId")).longValue());
        assertTrue(((Number) result.get("roomDimensionCount")).intValue() >= 2);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> candidates = (List<Map<String, Object>>) result.get("roomDimensionCandidates");
        assertNotNull(candidates);
        assertFalse(candidates.isEmpty());
    }

    @Test
    void testGetApplicationReportForApplication8() {
        Map<String, Object> report = analysisService.getApplicationReport(8L);
        assertNotNull(report);
        assertEquals(8L, ((Number) report.get("applicationId")).longValue());
        assertTrue(report.containsKey("metrics"));
        assertTrue(report.containsKey("ruleResults"));
        assertTrue(report.containsKey("verifiedMeasurements"));
    }

    @Test
    void testVerifiedMeasurementValidation() {
        // 1. Missing application ID throws exception
        VerifiedMeasurement invalid = new VerifiedMeasurement();
        invalid.setDocumentId(2L);
        invalid.setOfficerId(2L);
        invalid.setMeasurementType("ROOM_DIMENSIONS");
        invalid.setVerifiedValue1(10.0);
        invalid.setUnit(VerifiedMeasurement.MeasurementUnit.m);
        invalid.setVerificationStatus(VerifiedMeasurement.VerificationStatus.VERIFIED);

        assertThrows(IllegalArgumentException.class, () -> verifiedMeasurementService.saveMeasurement(invalid));

        // 2. Mismatched document and application throws exception
        invalid.setApplicationId(1L); // Document 2 belongs to application 8, not 1
        assertThrows(IllegalArgumentException.class, () -> verifiedMeasurementService.saveMeasurement(invalid));

        // 3. Negative value throws exception
        VerifiedMeasurement negativeVal = new VerifiedMeasurement();
        negativeVal.setApplicationId(8L);
        negativeVal.setDocumentId(2L);
        negativeVal.setOfficerId(2L);
        negativeVal.setMeasurementType("ROOM_DIMENSIONS");
        negativeVal.setVerifiedValue1(-5.0);
        negativeVal.setUnit(VerifiedMeasurement.MeasurementUnit.m);
        negativeVal.setVerificationStatus(VerifiedMeasurement.VerificationStatus.VERIFIED);

        assertThrows(IllegalArgumentException.class, () -> verifiedMeasurementService.saveMeasurement(negativeVal));
    }

    @Test
    @Transactional
    void testSaveVerifiedMeasurementSuccess() {
        VerifiedMeasurement vm = new VerifiedMeasurement();
        vm.setApplicationId(8L);
        vm.setDocumentId(2L);
        vm.setOfficerId(2L);
        vm.setMeasurementType("FRONT_SETBACK");
        vm.setOriginalValue1(3.0);
        vm.setVerifiedValue1(3.5);
        vm.setUnit(VerifiedMeasurement.MeasurementUnit.m);
        vm.setVerificationStatus(VerifiedMeasurement.VerificationStatus.CORRECTED);
        vm.setOfficerRemarks("Automated test verification");

        VerifiedMeasurement saved = verifiedMeasurementService.saveMeasurement(vm);
        assertNotNull(saved.getId());
        assertEquals("FRONT_SETBACK", saved.getMeasurementType());
        assertEquals(3.5, saved.getVerifiedValue1());
        assertEquals(VerifiedMeasurement.VerificationStatus.CORRECTED, saved.getVerificationStatus());
    }

    @Test
    void testEvaluateRulesWithVerifiedMeasurements() {
        List<Map<String, Object>> results = analysisService.evaluateRulesWithVerifiedMeasurements(8L);
        assertNotNull(results);
        assertFalse(results.isEmpty());
        // For app 8, MIN_ROAD_WIDTH (12m >= 9m) -> PASS, MAX_FLOORS (2 <= 4) -> PASS
        assertTrue(results.stream().anyMatch(r -> "MIN_ROAD_WIDTH".equals(r.get("ruleCode")) && "PASS".equals(r.get("status"))));
        assertTrue(results.stream().anyMatch(r -> "MAX_FLOORS".equals(r.get("ruleCode")) && "PASS".equals(r.get("status"))));
    }

    @Test
    @Transactional
    void testApproveApplicationAndCertificateCreation() {
        BuildingApplication testApp = new BuildingApplication();
        testApp.setApplicantId(1L);
        testApp.setDistrictId(1L);
        testApp.setApplicationNumber("TEST-APP-" + System.currentTimeMillis());
        testApp.setPlotNumber("101");
        testApp.setSurveyNumber("202");
        testApp.setPlotArea(150.0);
        testApp.setRoadWidth(10.0);
        testApp.setBuildingType("RESIDENTIAL");
        testApp.setFloors(2);
        testApp.setStatus("UNDER_OFFICER_REVIEW");
        testApp = applicationRepository.save(testApp);

        ResponseEntity<BuildingApplication> response = applicationController.approveApplication(
                testApp.getId(), Map.of("remarks", "Approved in automated test"));
        assertEquals(200, response.getStatusCode().value());
        assertEquals("APPROVED", response.getBody().getStatus());

        // Check certificate generated
        ResponseEntity<Map<String, Object>> certResponse = applicationController.getApplicationCertificate(testApp.getId());
        assertEquals(200, certResponse.getStatusCode().value());
        assertTrue((Boolean) certResponse.getBody().get("hasCertificate"));
        assertNotNull(certResponse.getBody().get("certificateNumber"));

        // Check status history
        List<Map<String, Object>> history = applicationController.getApplicationStatusHistory(testApp.getId());
        assertFalse(history.isEmpty());
        assertTrue(history.stream().anyMatch(h -> "APPROVED".equals(h.get("toStatus"))));
    }
}
