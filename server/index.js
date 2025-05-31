// backend/index.js
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/consultar-envios", async (req, res) => {
  const pedidos = req.body; // Esperamos un array de objetos con TN, Cliente, etc.

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const estadosPermitidos = [
    "ENTREGA EN SUCURSAL",
    "ENTREGADO",
    "EN ESPERA EN SUCURSAL",
  ];

  const resultados = [];

  const pedidosValidos = pedidos.filter((p) => p.TN && p.TN.trim() !== "");


  for (const pedido of pedidosValidos) {
    const codigo = pedido.TN;
    console.log(`Consultando: ${codigo}`);

    try {
      await page.goto(
        `https://www.correoargentino.com.ar/formularios/e-commerce?id=${codigo}`
      );

      await Promise.all([page.click('button[id="btsubmit"]')]);
      await page.waitForSelector("table.table-hover tbody tr");

      const datos = await page.evaluate(() => {
        const filas = Array.from(
          document.querySelectorAll("table.table-hover tbody tr")
        );

        const eventos = filas.map((fila) => {
          const celdas = Array.from(fila.querySelectorAll("td")).map((celda) =>
            celda.innerText.trim()
          );

          return {
            estado: celdas[3],
          };
        });

        return (
          eventos.find((evento) => evento.estado !== "") || {
            estado: "Sin datos",
          }
        );
      });

      if (estadosPermitidos.includes(datos.estado)) {
        resultados.push({
          "ID Pedido": pedido["ID Pedido"],
          Cliente: pedido.Cliente,
          Monto: pedido.Monto,
          TN: codigo,
          "Estado actual": datos.estado,
          Whatsapp: pedido.Whatsapp,
        });
      }
    } catch (error) {
      console.error(`❌ Error con ${codigo}:`, error.message);
      resultados.push({
        ...pedido,
        "Estado actual": "Error al consultar",
      });
    }
  }

  await browser.close();
  res.json(resultados);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
