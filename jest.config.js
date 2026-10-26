/**
 * Jest (preset jest-expo): testes das regras e dos mapeadores puros do app, em tests/. O check:core continua
 * rodando à parte (npm run check:core). Cobertura: npm run test:coverage.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  // Padrão do jest-expo mais o lucide-react-native: os ícones são importados um a um (arquivos .mjs) e precisam ser
  // transformados como os pacotes do React Native
  transform: { '\\.mjs$': 'babel-jest' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native)',
  ],
  collectCoverageFrom: [
    'src/lib/{apiTime,dailyReport,date,doseLive,doseRules,formErrors,history,jwt,masks,medicationMeta,password,schemas,serverClock}.ts',
    'src/features/patient/nextDose.ts',
    'src/features/medications/formValues.ts',
    'src/adapters/http/{apiError,ids}.ts',
    'src/adapters/http/{HttpDoseService,HttpPatientService,HttpMedicationService,HttpReportService}.ts',
  ],
  // lcov: lido pelo SonarQube (docs/qualidade.md)
  coverageReporters: ['text-summary', 'text', 'lcov'],
  // npm run test:coverage falha abaixo disto: o piso do que já existe (só pode subir; nunca baixe para passar)
  coverageThreshold: {
    global: { statements: 83, branches: 83, functions: 77, lines: 84 },
  },
};
