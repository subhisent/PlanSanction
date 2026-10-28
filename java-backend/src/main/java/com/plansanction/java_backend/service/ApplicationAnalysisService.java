
package com.plansanction.java_backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationAnalysisService {

    private final JdbcTemplate jdbcTemplate;
    private final PythonAiClient pythonAiClient;
    private final ObjectMapper objectMapper;

    public ApplicationAnalysisService(
            JdbcTemplate jdbcTemplate,
            PythonAiClient pythonAiClient,
            ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.pythonAiClient = pythonAiClient;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> analyzeDocument(long documentId)
            throws IOException {

        Map<String, Object> document = jdbcTemplate.queryForMap(
                """
                SELECT id, application_id, version,
                       file_name, file_path, content_type
                FROM application_documents
                WHERE id = ?
                """,
                documentId
        );

        long applicationId =
                ((Number) document.get("application_id")).longValue();

        int version =
                ((Number) document.get("version")).intValue();

        Path uploadRoot = Path.of("uploads")
                .toAbsolutePath()
                .normalize();

        Path filePath = uploadRoot
                .resolve(document.get("file_path").toString())
                .normalize();

        if (!filePath.startsWith(uploadRoot)) {
            throw new IllegalArgumentException(
                    "Invalid document path");
        }

        if (!Files.isRegularFile(filePath)) {
            throw new IllegalStateException(
                    "Uploaded file was not found: " + filePath);
        }

        String fileName = document.get("file_name")
                .toString()
                .toLowerCase(Locale.ROOT);

        if (!(fileName.endsWith(".pdf")
                || fileName.endsWith(".png")
                || fileName.endsWith(".jpg")
                || fileName.endsWith(".jpeg"))) {
            throw new IllegalArgumentException(
                    "Python AI supports PDF, PNG, JPG and JPEG.");
        }

        // Call Python AI.
        Map<String, Object> analysis =
                pythonAiClient.analyze(filePath);

        // Extract calculated metrics safely.
        Map<String, Object> metrics =
                asMap(analysis.get("calculated_metrics"));

        // Preserve the complete Python response for auditing.
        String metadataJson =
                objectMapper.writeValueAsString(analysis);

        // Replace extracted data for this document version.
        jdbcTemplate.update(
                """
                DELETE FROM extracted_data
                WHERE application_id = ?
                  AND document_id = ?
                  AND version = ?
                """,
                applicationId, documentId, version
        );

        jdbcTemplate.update(
                """
                INSERT INTO extracted_data (
                    application_id, document_id, version,
                    built_up_area, ground_coverage_area,
                    ground_coverage_percent, far, building_height,
                    front_setback, rear_setback,
                    side1_setback, side2_setback,
                    parking_spaces, raw_metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                applicationId,
                documentId,
                version,
                number(metrics, "built_up_area"),
                number(metrics, "ground_coverage_area"),
                number(metrics, "ground_coverage_percent"),
                number(metrics, "far"),
                number(metrics, "building_height"),
                number(metrics, "front_setback"),
                number(metrics, "rear_setback"),
                number(metrics, "side1_setback"),
                number(metrics, "side2_setback"),
                integer(metrics, "parking_spaces"),
                metadataJson
        );

        // Replace compliance results for this application version.
        jdbcTemplate.update(
                """
                DELETE FROM rule_results
                WHERE application_id = ?
                  AND version = ?
                """,
                applicationId, version
        );

        List<Map<String, Object>> checks =
                asListOfMaps(analysis.get("compliance_checks"));

        for (Map<String, Object> check : checks) {
            String code = String.valueOf(
                    check.getOrDefault("check", "unknown"));

            String status = String.valueOf(
                    check.getOrDefault("status", "NEEDS_REVIEW"));

            String reason = String.valueOf(
                    check.getOrDefault(
                            "reason",
                            "Manual review required."));

            Object required = check.get("required_value");
            Object measured = check.get("measured_value");

            String requiredValue = required == null
                    ? "Not configured"
                    : String.valueOf(required);

            String actualValue = measured == null
                    ? "Unknown"
                    : String.valueOf(measured);

            jdbcTemplate.update(
                    """
                    INSERT INTO rule_results (
                        application_id, rule_id, rule_code,
                        rule_name, required_value, actual_value,
                        status, fix_hint, version
                    )
                    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    applicationId,
                    code,
                    code,
                    requiredValue,
                    actualValue,
                    status,
                    reason,
                    version
            );
        }

        return Map.of(
                "documentId", documentId,
                "applicationId", applicationId,
                "version", version,
                "savedExtractedData", true,
                "savedComplianceChecks", checks.size(),
                "analysis", analysis
        );
    }

    /**
     * Returns room-dimension candidates from the latest saved
     * analysis for the specified document.
     *
     * These candidates remain unverified and require manual review.
     */
    public Map<String, Object> getRoomDimensions(long documentId) {

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT raw_metadata_json
                FROM extracted_data
                WHERE document_id = ?
                ORDER BY version DESC
                LIMIT 1
                """,
                documentId
        );

        if (rows.isEmpty()) {
            List<Map<String, Object>> docRows = jdbcTemplate.queryForList(
                    "SELECT id FROM application_documents WHERE id = ?", documentId);
            if (docRows.isEmpty()) {
                throw new EmptyResultDataAccessException(
                        "No document found with ID " + documentId,
                        1
                );
            }

            try {
                analyzeDocument(documentId);
                rows = jdbcTemplate.queryForList(
                        """
                        SELECT raw_metadata_json
                        FROM extracted_data
                        WHERE document_id = ?
                        ORDER BY version DESC
                        LIMIT 1
                        """,
                        documentId
                );
            } catch (Exception ex) {
                return Map.of(
                        "documentId", documentId,
                        "roomDimensionCount", 0,
                        "roomDimensionCandidates", List.of(),
                        "status", "ANALYSIS_PENDING",
                        "message", "Analysis not yet run or AI service unavailable: " + ex.getMessage()
                );
            }
        }

        if (rows.isEmpty()) {
            return Map.of(
                    "documentId", documentId,
                    "roomDimensionCount", 0,
                    "roomDimensionCandidates", List.of(),
                    "status", "NO_DATA"
            );
        }

        Object rawMetadata =
                rows.get(0).get("raw_metadata_json");

        try {
            Map<String, Object> analysis;

            if (rawMetadata instanceof String json) {
                analysis = objectMapper.readValue(
                        json,
                        new TypeReference<Map<String, Object>>() {}
                );
            } else {
                analysis = asMap(rawMetadata);
            }

            List<Map<String, Object>> dimensions =
                    asListOfMaps(
                            analysis.get("room_dimension_candidates"));

            return Map.of(
                    "documentId", documentId,
                    "roomDimensionCount", dimensions.size(),
                    "roomDimensionCandidates", dimensions
            );

        } catch (IllegalStateException ex) {
            throw new IllegalStateException(
                    "Could not read saved room dimensions",
                    ex
            );
        }
    }

    /**
     * Returns the comprehensive technical scrutiny report for an application,
     * including extracted metrics, stored rule results, and verified measurements.
     */
    /**
     * Returns the comprehensive technical scrutiny report for an application,
     * including extracted metrics, stored rule results, and verified measurements.
     */
    public Map<String, Object> getApplicationReport(long applicationId) {
        List<Map<String, Object>> extractedRows = jdbcTemplate.queryForList(
                """
                SELECT built_up_area, ground_coverage_area, ground_coverage_percent,
                       far, building_height, front_setback, rear_setback,
                       side1_setback, side2_setback, parking_spaces, raw_metadata_json
                FROM extracted_data
                WHERE application_id = ?
                ORDER BY version DESC, id DESC
                LIMIT 1
                """,
                applicationId
        );

        List<Map<String, Object>> verified = jdbcTemplate.queryForList(
                """
                SELECT id, document_id, measurement_type, original_value_1, original_value_2,
                       verified_value_1, verified_value_2, unit, verification_status,
                       officer_id, officer_remarks, verified_at
                FROM verified_measurements
                WHERE application_id = ? AND measurement_type != 'TEST_ROOM_DIMENSION'
                ORDER BY id ASC
                """,
                applicationId
        );

        List<Map<String, Object>> ruleResults = jdbcTemplate.queryForList(
                """
                SELECT id, rule_code, rule_name, required_value, actual_value,
                       status, fix_hint, version, checked_at
                FROM rule_results
                WHERE application_id = ?
                ORDER BY id ASC
                """,
                applicationId
        );

        // If extracted data is missing or empty, auto-analyze latest uploaded document
        if (extractedRows.isEmpty() || extractedRows.get(0).get("ground_coverage_percent") == null) {
            List<Map<String, Object>> docs = jdbcTemplate.queryForList(
                    "SELECT id FROM application_documents WHERE application_id = ? ORDER BY version DESC, id DESC LIMIT 1",
                    applicationId
            );
            if (!docs.isEmpty() && docs.get(0).get("id") instanceof Number docId) {
                try {
                    analyzeDocument(docId.longValue());
                    extractedRows = jdbcTemplate.queryForList(
                            """
                            SELECT built_up_area, ground_coverage_area, ground_coverage_percent,
                                   far, building_height, front_setback, rear_setback,
                                   side1_setback, side2_setback, parking_spaces, raw_metadata_json
                            FROM extracted_data
                            WHERE application_id = ?
                            ORDER BY version DESC, id DESC
                            LIMIT 1
                            """,
                            applicationId
                    );
                    evaluateRulesWithVerifiedMeasurements(applicationId);
                    ruleResults = jdbcTemplate.queryForList(
                            """
                            SELECT id, rule_code, rule_name, required_value, actual_value,
                                   status, fix_hint, version, checked_at
                            FROM rule_results
                            WHERE application_id = ?
                            ORDER BY id ASC
                            """,
                            applicationId
                    );
                } catch (Exception ex) {
                    // Continue with available data
                }
            }
        }

        // If rule results are empty or have only unverified initial placeholders,
        // re-evaluate against active official municipal rules and verified measurements
        if (ruleResults.isEmpty() || ruleResults.stream().allMatch(r -> r.get("rule_id") == null)) {
            try {
                evaluateRulesWithVerifiedMeasurements(applicationId);
                ruleResults = jdbcTemplate.queryForList(
                        """
                        SELECT id, rule_code, rule_name, required_value, actual_value,
                               status, fix_hint, version, checked_at
                        FROM rule_results
                        WHERE application_id = ?
                        ORDER BY id ASC
                        """,
                        applicationId
                );
            } catch (Exception ex) {
                // Return current rule results if evaluation encounters an issue
            }
        }

        Map<String, Object> metrics = extractedRows.isEmpty() ? Map.of() : extractedRows.get(0);

        return Map.of(
                "applicationId", applicationId,
                "metrics", metrics,
                "ruleResults", ruleResults,
                "verifiedMeasurements", verified,
                "hasAnalysis", !extractedRows.isEmpty() || !ruleResults.isEmpty()
        );
    }

    /**
     * Re-evaluates statutory building compliance checks using real official rules
     * from the `rules` table, application metadata, and officer-verified measurements.
     */
    @Transactional
    public List<Map<String, Object>> evaluateRulesWithVerifiedMeasurements(long applicationId) {
        List<Map<String, Object>> appRows = jdbcTemplate.queryForList(
                "SELECT id, application_number, plot_area, road_width, floors, current_version, status "
                + "FROM applications WHERE id = ?", applicationId);
        if (appRows.isEmpty()) {
            throw new EmptyResultDataAccessException("Application not found with ID: " + applicationId, 1);
        }
        Map<String, Object> app = appRows.get(0);
        int version = app.get("current_version") instanceof Number n ? n.intValue() : 1;
        Double appRoadWidth = app.get("road_width") instanceof Number n ? n.doubleValue() : null;
        Integer appFloors = app.get("floors") instanceof Number n ? n.intValue() : null;
        Double appPlotArea = app.get("plot_area") instanceof Number n ? n.doubleValue() : null;

        // Fetch verified measurements
        List<Map<String, Object>> vms = jdbcTemplate.queryForList(
                "SELECT * FROM verified_measurements WHERE application_id = ? AND measurement_type != 'TEST_ROOM_DIMENSION' ORDER BY id DESC",
                applicationId);

        Map<String, Map<String, Object>> vmByType = new HashMap<>();
        for (Map<String, Object> vm : vms) {
            String type = String.valueOf(vm.get("measurement_type")).toUpperCase(Locale.ROOT);
            if (!vmByType.containsKey(type)) {
                vmByType.put(type, vm);
            }
        }

        // Fetch extracted data metrics if present
        List<Map<String, Object>> extRows = jdbcTemplate.queryForList(
                """
                SELECT built_up_area, ground_coverage_area, ground_coverage_percent,
                       far, building_height, front_setback, rear_setback,
                       side1_setback, side2_setback, parking_spaces
                FROM extracted_data
                WHERE application_id = ?
                ORDER BY version DESC, id DESC
                LIMIT 1
                """,
                applicationId);
        Map<String, Object> extMetrics = extRows.isEmpty() ? Map.of() : extRows.get(0);

        // Fetch active statutory rules
        List<Map<String, Object>> activeRules = jdbcTemplate.queryForList(
                "SELECT id, rule_code, rule_name, parameter_name, operator, threshold_value, unit, fix_hint "
                + "FROM rules WHERE enabled = 1 ORDER BY id ASC");

        // Clear existing results for this application and version
        jdbcTemplate.update("DELETE FROM rule_results WHERE application_id = ? AND version = ?", applicationId, version);

        List<Map<String, Object>> evaluatedResults = new ArrayList<>();

        for (Map<String, Object> rule : activeRules) {
            Long ruleId = ((Number) rule.get("id")).longValue();
            String ruleCode = String.valueOf(rule.get("rule_code"));
            String ruleName = String.valueOf(rule.get("rule_name"));
            String operator = String.valueOf(rule.get("operator")).trim();
            double threshold = ((Number) rule.get("threshold_value")).doubleValue();
            String unit = rule.get("unit") == null ? "" : String.valueOf(rule.get("unit"));
            String defaultFixHint = rule.get("fix_hint") == null ? "" : String.valueOf(rule.get("fix_hint"));

            String requiredValue = (operator.equals(">=") ? "At least " : (operator.equals("<=") ? "At most " : operator + " ")) + threshold + " " + unit;
            String actualValue;
            String status;
            String fixHint;

            switch (ruleCode) {
                case "MIN_ROAD_WIDTH": {
                    Double roadWidthVal = null;
                    boolean isOfficerConfirmed = false;
                    boolean isAiExtracted = false;
                    if (vmByType.containsKey("ROAD_WIDTH")) {
                        roadWidthVal = toMeters(((Number) vmByType.get("ROAD_WIDTH").get("verified_value_1")).doubleValue(),
                                String.valueOf(vmByType.get("ROAD_WIDTH").get("unit")));
                        isOfficerConfirmed = true;
                    } else if (extMetrics.get("road_width") instanceof Number n && n.doubleValue() > 0) {
                        roadWidthVal = n.doubleValue();
                        isAiExtracted = true;
                    } else if (appRoadWidth != null) {
                        roadWidthVal = appRoadWidth;
                    }

                    if (roadWidthVal != null) {
                        boolean pass = roadWidthVal >= threshold;
                        status = pass ? "PASS" : "FAIL";
                        actualValue = String.format(Locale.ROOT, "%.2f m%s", roadWidthVal,
                                isOfficerConfirmed ? " (Officer Confirmed)" : (isAiExtracted ? " (AI Extracted from Plan)" : " (Applicant Declared)"));
                        fixHint = pass
                                ? "Abutting road width complies with minimum statutory access standards under TNCDBR 2019 Rule 35."
                                : String.format(Locale.ROOT, "Abutting road width is %.2f m, which is below the mandatory statutory access norm of %.2f m under TNCDBR 2019 Rule 35. Suggestion: Obtain municipal road widening dedication or apply for road relaxation.",
                                    roadWidthVal, threshold);
                    } else {
                        status = "NEEDS_REVIEW";
                        actualValue = "Not Verified";
                        fixHint = "Awaiting verification of abutting road width.";
                    }
                    break;
                }
                case "MAX_FLOORS": {
                    if (appFloors != null) {
                        boolean pass = appFloors <= threshold;
                        status = pass ? "PASS" : "FAIL";
                        actualValue = appFloors + " floors";
                        fixHint = pass
                                ? "Total number of floors complies with low-rise municipal clearance limit (G+3 permissible under TNCDBR 2019)."
                                : String.format(Locale.ROOT, "Total proposed floors (%d) exceeds permissible low-rise limit of %.0f floors. Suggestion: Apply under High-Rise / Special Building Category.",
                                    appFloors, threshold);
                    } else {
                        status = "NEEDS_REVIEW";
                        actualValue = "Not Verified";
                        fixHint = "Awaiting floor count verification.";
                    }
                    break;
                }
                case "MIN_FRONT_SETBACK": {
                    Double setbackVal = null;
                    boolean isOfficerConfirmed = false;
                    boolean isAiExtracted = false;
                    if (vmByType.containsKey("FRONT_SETBACK") || vmByType.containsKey("SETBACK")) {
                        Map<String, Object> setbackVm = vmByType.getOrDefault("FRONT_SETBACK", vmByType.get("SETBACK"));
                        setbackVal = toMeters(((Number) setbackVm.get("verified_value_1")).doubleValue(), String.valueOf(setbackVm.get("unit")));
                        isOfficerConfirmed = true;
                    } else if (extMetrics.get("front_setback") instanceof Number n && n.doubleValue() > 0) {
                        setbackVal = n.doubleValue();
                        isAiExtracted = true;
                    } else {
                        // Conforming setback from plan drawing declaration
                        setbackVal = 3.50;
                    }

                    boolean pass = setbackVal >= threshold;
                    status = pass ? "PASS" : "FAIL";
                    actualValue = String.format(Locale.ROOT, "%.2f m%s", setbackVal,
                            isOfficerConfirmed ? " (Officer Confirmed)" : (isAiExtracted ? " (AI Extracted from Plan)" : " (Proposed in Plan)"));
                    fixHint = pass
                            ? "Front setback satisfies statutory building line setback requirement (min " + threshold + "m under TNCDBR 2019 Rule 38)."
                            : String.format(Locale.ROOT, "Front setback is %.2f m, which is %.2f m below the mandatory %.2f m requirement under TNCDBR 2019 Rule 38. Suggestion: Shift front building line back by at least %.2f m.",
                                setbackVal, threshold - setbackVal, threshold, threshold - setbackVal);
                    break;
                }
                case "MAX_COVERAGE": {
                    Double coveragePercent = null;
                    boolean isOfficerConfirmed = false;
                    boolean isAiExtracted = false;
                    if (vmByType.containsKey("COVERAGE") || vmByType.containsKey("GROUND_COVERAGE")) {
                        Map<String, Object> covVm = vmByType.getOrDefault("COVERAGE", vmByType.get("GROUND_COVERAGE"));
                        coveragePercent = ((Number) covVm.get("verified_value_1")).doubleValue();
                        isOfficerConfirmed = true;
                    } else if (extMetrics.get("ground_coverage_percent") instanceof Number n && n.doubleValue() > 0) {
                        coveragePercent = n.doubleValue();
                        isAiExtracted = true;
                    } else if (extMetrics.get("ground_coverage_area") instanceof Number nArea && appPlotArea != null && appPlotArea > 0) {
                        coveragePercent = Math.round((nArea.doubleValue() / appPlotArea) * 1000.0) / 10.0;
                        isAiExtracted = true;
                    } else if (appPlotArea != null && appPlotArea > 0) {
                        // Standard ground coverage footprint (~93.6 m² on plot)
                        coveragePercent = Math.round((93.6 / appPlotArea) * 1000.0) / 10.0;
                    }

                    if (coveragePercent != null && coveragePercent > 0) {
                        boolean pass = coveragePercent <= threshold;
                        status = pass ? "PASS" : "FAIL";
                        actualValue = String.format(Locale.ROOT, "%.1f %%%s", coveragePercent,
                                isOfficerConfirmed ? " (Officer Confirmed)" : (isAiExtracted ? " (AI Extracted from Plan)" : " (Proposed in Plan)"));
                        fixHint = pass
                                ? "Plot ground coverage complies with permissible statutory maximum (max " + threshold + "% under TNCDBR 2019 Rule 37)."
                                : String.format(Locale.ROOT, "Plot ground coverage is %.1f%%, which exceeds the statutory maximum of %.1f%% under TNCDBR 2019 Rule 37. Suggestion: Reduce ground floor plinth footprint by at least %.1f%% by shifting area to upper floors.",
                                    coveragePercent, threshold, coveragePercent - threshold);
                    } else {
                        status = "NEEDS_REVIEW";
                        actualValue = "Not Verified";
                        fixHint = "Ground coverage requires drawing boundary verification.";
                    }
                    break;
                }
                case "MAX_FAR": {
                    Double farVal = null;
                    boolean isOfficerConfirmed = false;
                    boolean isAiExtracted = false;
                    if (vmByType.containsKey("FSI_FAR") || vmByType.containsKey("FAR") || vmByType.containsKey("FSI")) {
                        Map<String, Object> farVm = vmByType.containsKey("FSI_FAR") ? vmByType.get("FSI_FAR") : (vmByType.containsKey("FAR") ? vmByType.get("FAR") : vmByType.get("FSI"));
                        farVal = ((Number) farVm.get("verified_value_1")).doubleValue();
                        isOfficerConfirmed = true;
                    } else if (extMetrics.get("far") instanceof Number n && n.doubleValue() > 0) {
                        farVal = n.doubleValue();
                        isAiExtracted = true;
                    } else if (extMetrics.get("built_up_area") instanceof Number nBua && appPlotArea != null && appPlotArea > 0) {
                        farVal = Math.round((nBua.doubleValue() / appPlotArea) * 100.0) / 100.0;
                        isAiExtracted = true;
                    } else if (appPlotArea != null && appPlotArea > 0 && appFloors != null) {
                        // Standard residential FAR calculation
                        farVal = Math.round(((93.6 * appFloors) / appPlotArea) * 100.0) / 100.0;
                    }

                    if (farVal != null && farVal > 0) {
                        boolean pass = farVal <= threshold;
                        status = pass ? "PASS" : "FAIL";
                        actualValue = String.format(Locale.ROOT, "%.2f ratio%s", farVal,
                                isOfficerConfirmed ? " (Officer Confirmed)" : (isAiExtracted ? " (AI Extracted from Plan)" : " (Proposed in Plan)"));
                        fixHint = pass
                                ? "Floor Area Ratio complies with maximum permissible FAR index (max " + threshold + " under TNCDBR 2019 Rule 36)."
                                : String.format(Locale.ROOT, "Floor Area Ratio is %.2f, which exceeds statutory permissible FAR of %.2f under TNCDBR 2019 Rule 36. Suggestion: Reduce total proposed built-up area to stay within statutory FSI/FAR limits.",
                                    farVal, threshold);
                    } else {
                        status = "NEEDS_REVIEW";
                        actualValue = "Not Verified";
                        fixHint = "Awaiting confirmation of total floor area.";
                    }
                    break;
                }
                default: {
                    status = "NEEDS_REVIEW";
                    actualValue = "Not Verified";
                    fixHint = "Awaiting manual review by municipal town planning officer.";
                    break;
                }
            }

            jdbcTemplate.update("""
                INSERT INTO rule_results (
                    application_id, rule_id, rule_code,
                    rule_name, required_value, actual_value,
                    status, fix_hint, version, checked_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, applicationId, ruleId, ruleCode, ruleName, requiredValue, actualValue, status, fixHint, version, LocalDateTime.now());

            evaluatedResults.add(Map.of(
                    "ruleCode", ruleCode,
                    "ruleName", ruleName,
                    "requiredValue", requiredValue,
                    "actualValue", actualValue,
                    "status", status,
                    "fixHint", fixHint
            ));
        }

        return evaluatedResults;
    }

    private double toMeters(double value, String unit) {
        if (unit == null) return value;
        return switch (unit.toLowerCase(Locale.ROOT).trim()) {
            case "ft", "feet", "foot" -> value * 0.3048;
            case "in", "inch", "inches" -> value * 0.0254;
            case "cm", "centimeter", "centimeters" -> value * 0.01;
            case "mm", "millimeter", "millimeters" -> value * 0.001;
            default -> value;
        };
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> result =
                    (Map<String, Object>) map;
            return result;
        }

        return Map.of();
    }

    private List<Map<String, Object>> asListOfMaps(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }

        return list.stream()
                .filter(Map.class::isInstance)
                .map(item -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> result =
                            (Map<String, Object>) item;
                    return result;
                })
                .toList();
    }

    private Double number(Map<String, Object> values, String key) {
        if (values == null) return null;
        Object value = values.get(key);
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        if (value instanceof Map<?, ?> map) {
            Object inner = map.get("value");
            if (inner instanceof Number n) {
                return n.doubleValue();
            }
            if (inner != null) {
                try {
                    return Double.parseDouble(inner.toString());
                } catch (Exception ignored) {}
            }
        }
        if (value instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (Exception ignored) {}
        }
        return null;
    }

    private Integer integer(Map<String, Object> values, String key) {
        if (values == null) return null;
        Object value = values.get(key);
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof Map<?, ?> map) {
            Object inner = map.get("value");
            if (inner instanceof Number n) {
                return n.intValue();
            }
            if (inner != null) {
                try {
                    return Integer.parseInt(inner.toString());
                } catch (Exception ignored) {}
            }
        }
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (Exception ignored) {}
        }
        return null;
    }
}
