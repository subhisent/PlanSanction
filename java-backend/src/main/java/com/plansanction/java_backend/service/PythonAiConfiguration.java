
package com.plansanction.java_backend.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PythonAiConfiguration {

    @Bean
    public PythonAiClient pythonAiClient() {
        return new PythonAiClient();
    }
}
