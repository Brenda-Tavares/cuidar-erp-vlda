import sqlite3

conn = sqlite3.connect(r'C:\ProgramData\Cuidar-ERP-VDA\Data\cuidar.db')
c = conn.cursor()

print("=== Schema 'alunos' ===")
c.execute("PRAGMA table_info(alunos)")
result = c.fetchall()
print("Schema alunos:", result)

print("\n=== Schema 'funcionarios' ===")
c.execute("PRAGMA table_info(funcionarios)")
result = c.fetchall()
print("Schema funcionarios:", result)

print("\n=== Schema 'mesalidades' ===")
c.execute("PRAGMA table_info(mesalidades)")
result = c.fetchall()
print("Schema mesalidades:", result)

# Check row counts
print("\n=== Contagem de linhas ===")
c.execute("SELECT COUNT(*) FROM alunos")
count = c.fetchone()[0]
print("Total alunos:", count)

c.execute("SELECT COUNT(*) FROM funcionarios")
count = c.fetchone()[0]
print("Total funcionarios:", count)

c.execute("SELECT COUNT(*) FROM mesalidades")
count = c.fetchone()[0]
print("Total mesalidades:", count)

# Sample data from alunos
print("\n=== Dados de exemplo - Alunos ===")
c.execute("SELECT * FROM alunos LIMIT 5")
rows = c.fetchall()
if rows:
    print("Colunas:", [desc[0] for desc in c.description])
    for row in rows:
        print(row)
else:
    print("Nenhum aluno encontrado")

conn.close()
print("\n--- FIM ---")