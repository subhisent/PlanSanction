
package com.plansanction.java_backend.repository;

import java.util.List;
import com.plansanction.java_backend.entity.BuildingApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BuildingApplicationRepository
        extends JpaRepository<BuildingApplication, Long> {

    List<BuildingApplication> findByAssignedOfficerId(Long assignedOfficerId);

    @Query("SELECT a FROM BuildingApplication a WHERE a.assignedOfficerId = :officerId OR a.assignedOfficerId IS NULL ORDER BY a.submittedAt DESC")
    List<BuildingApplication> findForOfficerQueue(@Param("officerId") Long officerId);
}

