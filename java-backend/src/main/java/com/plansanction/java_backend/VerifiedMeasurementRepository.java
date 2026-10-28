
package com.plansanction.java_backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VerifiedMeasurementRepository
        extends JpaRepository<VerifiedMeasurement, Long> {

    List<VerifiedMeasurement> findByApplicationId(Long applicationId);

    List<VerifiedMeasurement> findByDocumentId(Long documentId);

    List<VerifiedMeasurement> findByApplicationIdAndDocumentId(
            Long applicationId,
            Long documentId
    );
}
