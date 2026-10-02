import sqlite3

conn = sqlite3.connect(r'C:\ProgramData\Cuidar-ERP-VDA\Data\cuidar.db')
c = conn.cursor()

print("=== Todos os Alunos Cadastrados ===")
c.execute("SELECT * FROM alunos")
rows = c.fetchall()
print("Total:", len(rows))
print("Colunas:", [desc[0] for desc in c.description])
for row in rows:
    print(row)

print("\n=== Verificar dia_vencione ===")
for row in rows:
    if row[12] is not None:
        print(f"Aluno {row[1]} (id={row[0]}): dia_vencione = {row[12]}")
    else:
        print(f"Aluno {row[1]} (id={row[0]}): dia_vencione = NULL")

conn.close()