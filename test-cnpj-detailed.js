// Teste detalhado de validação de CNPJ

const validateCNPJ = (cnpj) => {
  const value = cnpj.replace(/\D/g, '');
  
  if (value.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(value)) return false;
  
  const calculateDigit = (base, startWeight) => {
    let sum = 0;
    let weight = startWeight;
    for (const char of base) {
      sum += Number(char) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  
  const firstDigit = calculateDigit(value.slice(0, 12), 5);
  const secondDigit = calculateDigit(value.slice(0, 12) + firstDigit, 6);
  
  return value.endsWith(`${firstDigit}${secondDigit}`);
};

const testCases = [
  '23.636.568/0001-30', // O CNPJ que o usuário mencionou
  '04.252.011/0001-10', // CNPJ válido do teste
  '11.222.333/0001-81', // Teste para ver qual seria válido
  '23.636.568/0001-07', // Corrigindo para 07
];

console.log('=== Teste de Validação de CNPJ ===\n');
testCases.forEach((cnpj) => {
  const isValid = validateCNPJ(cnpj);
  const normalized = cnpj.replace(/\D/g, '');
  
  // Calcular os dígitos corretos
  const value = normalized;
  const calculateDigit = (base, startWeight) => {
    let sum = 0;
    let weight = startWeight;
    for (const char of base) {
      sum += Number(char) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  
  const firstDigit = calculateDigit(value.slice(0, 12), 5);
  const secondDigit = calculateDigit(value.slice(0, 12) + firstDigit, 6);
  const correctEnding = `${firstDigit}${secondDigit}`;
  const actualEnding = value.slice(12);
  
  console.log(`CNPJ: ${cnpj}`);
  console.log(`Normalizado: ${normalized}`);
  console.log(`Dígitos verificadores esperados: ${correctEnding}`);
  console.log(`Dígitos verificadores reais: ${actualEnding}`);
  console.log(`Status: ${isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  console.log('---\n');
});
