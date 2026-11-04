# Contratos async

Todos los repositorios devuelven promesas y usan el binding D1 recibido por request.
No importan createApp/SQLite ni conservan identidad entre requests. money, validaciones
y estados conservan los resultados Node existentes. DTO de product/cart/order conserva
nombres y snapshots de feature001; tests de contrato comparan las formas consumidas
por el cliente. admin se implementará en su fase posterior al gate de staging.
