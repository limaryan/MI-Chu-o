# Mi chunõ — V1

Aplicação web pessoal de finanças com cadastro/login, dados separados por usuário, receitas, despesas, fechamento mensal, histórico, projeções simples e exportação de backup.

## 1. Criar o banco gratuito no Supabase
1. Crie uma conta em https://supabase.com e um novo projeto.
2. Abra **SQL Editor**.
3. Cole todo o conteúdo do arquivo `supabase.sql` e execute.
4. Vá em **Project Settings > API**.
5. Copie **Project URL** e **anon/public key**.
6. Abra `config.js` e substitua os dois valores de exemplo.

> Não coloque a `service_role key` no projeto. Use somente a `anon/public key`.

## 2. Configuração do login
Em **Authentication > Providers > Email**, deixe Email habilitado.

Para testes pessoais, você pode optar por desativar a exigência de confirmação de e-mail. Se deixar ligada, será necessário confirmar o cadastro pelo e-mail antes do primeiro login.

## 3. Publicar no GitHub Pages
1. Crie um repositório (por exemplo, `michuno`).
2. Envie os arquivos desta pasta para a raiz do repositório.
3. No GitHub: **Settings > Pages**.
4. Em Source, escolha **Deploy from a branch**.
5. Selecione a branch `main` e pasta `/root`.
6. Salve. O GitHub fornecerá o endereço do aplicativo.

## Segurança
- As senhas são administradas pelo Supabase Auth, não por esta aplicação.
- Os dados financeiros ficam no banco do Supabase, não no GitHub.
- As políticas RLS do `supabase.sql` fazem com que cada usuário só consiga acessar linhas cujo `user_id` seja o próprio usuário autenticado.
- A chave `anon` é apropriada para front-end quando RLS está corretamente ativado.

## Funcionalidades desta V1
- Criar conta e entrar.
- Configuração inicial de nome e dia de fechamento.
- Adicionar receita/despesa.
- Marcar lançamento como fixo.
- Confirmar/desmarcar lançamentos no cálculo do mês.
- Saldo, receitas e despesas no painel inicial.
- Fechar mês.
- Histórico de meses fechados.
- Projeções simples por média.
- Exportação dos dados para JSON.
- Layout responsivo para celular e computador.

## Próximos passos sugeridos
- Renovar automaticamente receitas/despesas fixas a cada novo mês.
- Editar lançamentos existentes.
- Parcelamentos e dívidas.
- Metas financeiras.
- Gráficos por categoria.
- Recuperação de senha.
- Ícone próprio e PWA offline mais completa.
