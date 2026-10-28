package com.plansanction.java_backend;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class DatabaseConnectionCheck {

    @Bean
    ApplicationRunner checkDatabaseConnection(JdbcTemplate jdbcTemplate) {
        return args -> {
            Integer result = jdbcTemplate.queryForObject(
                "SELECT 1",
                Integer.class
            );

            if (Integer.valueOf(1).equals(result)) {
                System.out.println(
                    "Database connection successful!"
                );
            }

            try {
                jdbcTemplate.execute(
                    "ALTER TABLE application_status_history MODIFY COLUMN from_status "
                    + "ENUM('SUBMITTED','AUTO_CHECKING','AUTO_REJECTED','UNDER_OFFICER_REVIEW','APPROVED','REJECTED','CORRECTIONS_REQUIRED') NULL"
                );
                jdbcTemplate.execute(
                    "ALTER TABLE application_status_history MODIFY COLUMN to_status "
                    + "ENUM('SUBMITTED','AUTO_CHECKING','AUTO_REJECTED','UNDER_OFFICER_REVIEW','APPROVED','REJECTED','CORRECTIONS_REQUIRED') NOT NULL"
                );
            } catch (Exception ex) {
                System.out.println("Note on application_status_history enum schema: " + ex.getMessage());
            }
        };
    }
}
