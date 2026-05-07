const cnpj = '23.636.568/0001-30';
const value = cnpj.replace(/\D/g, '');
console.log('CNPJ formatado:', cnpj);
console.log('CNPJ normalizado:', value);
console.log('Tamanho:', value.length);

// Validar manualmente
if (value.length !== 14) {
  console.log('FALHA: Tamanho errado');
  process.exit(0);
}

if (/^(\d)\1{13}$/.test(value)) {
  console.log('FALHA: Todos os dígitos são iguais');
  process.exit(0);
}

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
console.log('Primeiro dígito calculado:', firstDigit, '| esperado:', value[12]);
console.log('Segundo dígito calculado:', secondDigit, '| esperado:', value[13]);

const expected = `${firstDigit}${secondDigit}`;
const actual = value.slice(12);
const isValid = actual === expected;
console.log('Dígitos esperados:', expected);
console.log('Dígitos reais:', actual);
console.log(isValid ? 'CNPJ VÁLIDO' : 'CNPJ INVÁLIDO');
