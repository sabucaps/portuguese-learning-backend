const sentenceTemplates = [
  {
    id: "svo",
    structure: ["subject", "verb", "object"],
    difficulty: 1,
    description: "Subject-Verb-Object",
    examples: ["Eu como arroz", "Ela lê livros"]
  },
  {
    id: "sv",
    structure: ["subject", "verb"],
    difficulty: 1,
    description: "Subject-Verb",
    examples: ["Eu corro", "Nós estudamos"]
  },
  {
    id: "sv_prep_o",
    structure: ["subject", "verb", "preposition", "object"],
    difficulty: 2,
    description: "Subject-Verb-Preposition-Object",
    examples: ["Eu vou para casa", "Ela olha para o livro"]
  },
  {
    id: "s_adj_v",
    structure: ["subject", "adjective", "verb"],
    difficulty: 2,
    description: "Subject-Adjective-Verb",
    examples: ["O pequeno gato dorme", "A boa aluna estuda"]
  },
  {
    id: "s_v_adv",
    structure: ["subject", "verb", "adverb"],
    difficulty: 2,
    description: "Subject-Verb-Adverb",
    examples: ["Ela corre rapidamente", "Nós falamos bem"]
  },
  {
    id: "s_v_o_adv",
    structure: ["subject", "verb", "object", "adverb"],
    difficulty: 3,
    description: "Subject-Verb-Object-Adverb",
    examples: ["Eu como arroz rapidamente", "Ela lê livros silenciosamente"]
  },
  {
    id: "pron_s_v",
    structure: ["pronoun", "subject", "verb"],
    difficulty: 2,
    description: "Pronoun-Subject-Verb",
    examples: ["Eu eu estudo", "Você você come"]
  },
  {
    id: "s_v_o_prep_o",
    structure: ["subject", "verb", "object", "preposition", "object"],
    difficulty: 3,
    description: "Subject-Verb-Object-Preposition-Object",
    examples: ["Eu dou o livro para ela", "Nós compramos comida para casa"]
  }
];

module.exports = sentenceTemplates;