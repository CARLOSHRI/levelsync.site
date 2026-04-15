# LotoExpert Web

Aplicativo web PWA para apostas em loterias brasileiras (Mega Sena, LotoFácil e Quina) com recursos de inteligência artificial para geração de números.

## 🚀 Funcionalidades

- **Apostas em Loterias**: Mega Sena, LotoFácil e Quina
- **Geração de Números**: Manual, Surpresinha e IA Expert
- **Múltiplos Jogos**: Gere até 10 jogos por vez
- **Carteira Digital**: Depósitos e saques via PIX
- **Histórico**: Acompanhe suas apostas e transações
- **PWA**: Funciona offline após primeiro acesso
- **Persistência**: Dados salvos localmente

## 📁 Estrutura do Projeto

```
lotoexpert-web/
├── index.html          # Estrutura HTML principal
├── styles.css          # Estilos e tema
├── app.js              # Lógica principal da aplicação
├── sw.js               # Service Worker (PWA)
├── manifest.json       # Configuração PWA
├── package.json        # Dependências do projeto
├── js/
│   ├── utils.js       # Funções utilitárias
│   ├── storage.js      # Persistência com localStorage
│   ├── validators.js   # Validações de dados
│   ├── errors.js       # Tratamento de erros
│   └── loading.js      # Estados de carregamento
└── assets/
    ├── icon.png        # Ícone do app
    ├── megasena.png    # Logo Mega Sena
    ├── lotofacil.png   # Logo LotoFácil
    └── quina.png       # Logo Quina
```

## 🛠️ Tecnologias

- **HTML5** - Estrutura
- **CSS3** - Estilização
- **JavaScript (Vanilla)** - Lógica
- **Lucide Icons** - Ícones
- **Service Worker** - Cache offline
- **localStorage** - Persistência de dados

## 📦 Instalação

1. Clone ou baixe o repositório
2. Abra `index.html` em um servidor web local ou use um servidor HTTP simples:

```bash
# Com Python
python -m http.server 8000

# Com Node.js (http-server)
npx http-server

# Com PHP
php -S localhost:8000
```

3. Acesse `http://localhost:8000` no navegador

## 🎮 Como Usar

### Fazer uma Aposta

1. Na tela inicial, escolha uma loteria
2. Selecione o modo de geração:
   - **Manual**: Escolha os números manualmente
   - **Surpresinha**: Números aleatórios
   - **IA Expert**: Números gerados por IA
3. Se escolher Surpresinha ou IA, informe a quantidade de jogos (máx. 10)
4. Revise os números gerados
5. Clique em "Confirmar Aposta"

### Depósito

1. Acesse a aba "Carteira"
2. Clique em "Depositar"
3. Escolha o valor (mín. R$ 10,00)
4. Gere o QR Code PIX
5. Confirme o depósito

### Saque

1. Acesse a aba "Carteira"
2. Clique em "Sacar"
3. Informe o valor (mín. R$ 20,00)
4. Informe sua chave PIX
5. Confirme o saque

## 🔧 Configurações

### Limites Configuráveis

Os limites podem ser ajustados em `js/validators.js`:

```javascript
LIMITS: {
    DEPOSIT_MIN: 10,
    DEPOSIT_MAX: 10000,
    WITHDRAW_MIN: 20,
    WITHDRAW_MAX: 50000,
    GAMES_MAX: 10
}
```

### Cores do Tema

As cores principais podem ser alteradas em `styles.css`:

```css
:root {
    --accent-green: #22C55E;  /* Verde principal */
    --bg-primary: #0A0A0A;     /* Fundo */
    --text-primary: #FFFFFF;   /* Texto */
}
```

## 📱 PWA

O aplicativo é um Progressive Web App (PWA) e pode ser instalado:

- **Android**: Menu do Chrome → "Adicionar à tela inicial"
- **iOS**: Safari → Compartilhar → "Adicionar à Tela de Início"
- **Desktop**: Ícone de instalação na barra de endereços

## 🔒 Segurança

- Validação de todos os inputs
- Sanitização de dados
- Limites de valores configuráveis
- Tratamento de erros robusto

## 📝 Notas

- Os dados são salvos localmente no navegador (localStorage)
- Os resultados de loteria são simulados para demonstração
- A "IA Expert" é uma simulação visual - não realiza análise real

## 🐛 Troubleshooting

### Dados não estão sendo salvos
- Verifique se o navegador suporta localStorage
- Limpe o cache e tente novamente

### Service Worker não funciona
- Certifique-se de estar usando HTTPS ou localhost
- Verifique o console do navegador para erros

### Ícones não aparecem
- Verifique a conexão com a internet (Lucide Icons é carregado via CDN)
- Ou baixe e hospede localmente

## 📄 Licença

ISC

## 👨‍💻 Desenvolvimento

Para contribuir:

1. Faça suas alterações
2. Teste em diferentes navegadores
3. Mantenha a estrutura modular
4. Adicione validações onde necessário

## 🎯 Próximas Melhorias

- [ ] Integração com API real de loterias
- [ ] Autenticação de usuários
- [ ] Histórico de resultados real
- [ ] Notificações push
- [ ] Compartilhamento de apostas
- [ ] Estatísticas pessoais
