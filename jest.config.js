/**
 * Jest (preset jest-expo): testes das regras e dos mapeadores puros do app, em tests/. O check:core continua
 * rodando à parte (npm run check:core). Cobertura: npm run test:coverage.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  collectCoverageFrom: [
    'src/lib/{apiTime,dailyReport,date,doseLive,doseRules,formErrors,history,jwt,masks,medicationMeta,password,schemas,serverClock}.ts',
    'src/features/elder/nextDose.ts',
    'src/features/medications/formValues.ts',
    'src/adapters/http/{apiError,ids}.ts',
    'src/adapters/http/{HttpDoseService,HttpElderService,HttpMedicationService,HttpReportService}.ts',
  ],
  coverageReporters: ['text-summary', 'text'],
};
