import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
  const [excelData, setExcelData] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [resultados, setResultados] = useState([]); // ← NUEVO estado para lo que devuelve el backend
  const [filtradosNoPagados, setFiltradosNoPagados] = useState([]);
  const [verSeguimientos, setVerSeguimientos] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("Datos del Excel:", jsonData);
      setExcelData(jsonData);

      /* Hay que filtrar y guardar en un useState los datos del excel que en su estado correo no este vacio y que en su propiedad pagado esté en no */

      const filtrados = jsonData.filter((item) => item["Estado Correo"] === "");
      // Filtramos los que no están pagados y tienen estado de correo no vacío
      const filtradosNoPagados = jsonData.filter(
        (item) => item["¿Pagado?"] === "No" && item["Estado Correo"] !== ""
      );

      setFiltrados(filtrados);
      setFiltradosNoPagados(filtradosNoPagados);
    };

    reader.readAsArrayBuffer(file);
  };

  const enviarPedidos = async (pedidosFiltrados) => {
    const response = await fetch("http://localhost:3001/consultar-envios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pedidosFiltrados),
    });

    const data = await response.json();

    setResultados(data); // ← Guardamos resultados para renderizar
  };

  // Nuevo estado para guardar los pedidos atendidos
  const [atendidos, setAtendidos] = useState({});

  // Maneja el cambio del checkbox
  const handleCheck = (idPedido) => {
    setAtendidos((prev) => ({
      ...prev,
      [idPedido]: !prev[idPedido],
    }));
  };

  // Función para exportar una tabla a Excel
  const exportarTablaAExcel = (tipo) => {
    let datos = [];
    let nombreArchivo = "tabla.xlsx";

    if (tipo === "seguimientos") {
      datos = resultados;
      nombreArchivo = "seguimientos.xlsx";
    } else {
      datos = filtradosNoPagados;
      nombreArchivo = "no_pagados.xlsx";
    }

    if (!datos.length) return;

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, nombreArchivo);
  };

  return (
    <div style={{ padding: "2rem" }} className="AppDiv">
      <h1>Lectura y Filtro de Excel</h1>
      <div>
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        <button
          onClick={() => enviarPedidos(filtrados)}
          disabled={resultados.length > 0}
        >
          Enviar Pedidos
        </button>
      </div>

      <div className="buttons-container">
        <button onClick={() => setVerSeguimientos(true)}>
          Ver nuevos estados de seguimiento
        </button>
        <button onClick={() => setVerSeguimientos(false)}>
          Ver pedidos no pagados
        </button>
      </div>

      {verSeguimientos ? (
        resultados.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h3>📋 Resultados del seguimiento:</h3>
            <button onClick={() => exportarTablaAExcel("seguimientos")}>
              Exportar tabla a Excel
            </button>
            <table
              border="1"
              cellPadding="8"
              style={{ borderCollapse: "collapse", width: "100%" }}
            >
              <thead>
                <tr>
                  <th>Atendido</th>
                  <th>ID Pedido</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>TN</th>
                  <th>Estado actual</th>
                  <th>Whatsapp</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((pedido, index) => {
                  let mensaje = "";
                  if (
                    pedido["Estado actual"] === "ENTREGADO" ||
                    (pedido["Estado actual"] === "ENTREGA EN SUCURSAL" &&
                      pedido.Whatsapp)
                  ) {
                    mensaje = `Hola ${pedido.Cliente}, Me acaban de decir los chicos de correo que ya te entregaron el paquete 🙏🏻 por favor realizas la transferencia al siguiente:  CVU: 0000147800000057214968 el importe total es de ${pedido.Monto} 💵 *DESPUES ENVIAME EL COMPROBANTE POR FAVOR 🧾*`;
                  } else if (pedido["Estado actual"] === "EN ESPERA EN SUCURSAL") {
                    mensaje = `Sucursal 🏤 ¡Hola ${pedido.Cliente}! 😊 Tu pedido ya está esperando para ser retirado en una sucursal. En un ratito te vamos a avisar exactamente cuál es la sucursal 📍. Tenés 3 días para ir a buscarlo, ¡gracias por tu compra! 🙌`;
                  }
                  const urlWhatsapp = `https://api.whatsapp.com/send/?phone=${
                    pedido.Whatsapp
                  }&text=${encodeURIComponent(mensaje)}`;
                  return (
                    <tr key={index} style={atendidos[pedido["ID Pedido"]] ? { background: "#b4ffb4" } : {}}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!atendidos[pedido["ID Pedido"]]}
                          onChange={() => handleCheck(pedido["ID Pedido"])}
                        />
                      </td>
                      <td>{pedido["ID Pedido"]}</td>
                      <td>{pedido.Cliente}</td>
                      <td>${pedido.Monto}</td>
                      <td>{pedido.TN}</td>
                      <td>{pedido["Estado actual"]}</td>
                      <td>{pedido.Whatsapp}</td>
                      <td>
                        {(pedido["Estado actual"] === "ENTREGADO" ||
                          (pedido["Estado actual"] === "ENTREGA EN SUCURSAL" &&
                            pedido.Whatsapp)) && (
                          <a
                            href={urlWhatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <button>Enviar mensaje</button>
                          </a>
                        )}
                        {pedido["Estado actual"] === "EN ESPERA EN SUCURSAL" &&
                          pedido.Whatsapp && (
                            <a
                              href={urlWhatsapp}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <button>Enviar mensaje</button>
                            </a>
                          )}
                        {!(
                          (pedido["Estado actual"] === "ENTREGADO" ||
                            pedido["Estado actual"] === "ENTREGA EN SUCURSAL" ||
                            pedido["Estado actual"] === "EN ESPERA EN SUCURSAL") &&
                          pedido.Whatsapp
                        ) && "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div style={{ marginTop: "2rem" }}>
          <h3>Pedidos no pagados (Estado Correo no vacío):</h3>
          <button onClick={() => exportarTablaAExcel("no_pagados")}>
            Exportar tabla a Excel
          </button>
          <table
            border="1"
            cellPadding="8"
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr>
                <th>Atendido</th>
                <th>ID Pedido</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>TN</th>
                <th>Estado Correo</th>
                <th>Whatsapp</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtradosNoPagados.map((pedido, index) => {
                const mensaje = `Hola ${pedido.Cliente}, ¿cómo estás? Te escribo de Kivoo para recordarte que todavía está pendiente la transferencia del pedido de buzos 💸. Quedamos atentos a la confirmación. Gracias.`;
                const urlWhatsapp = `https://api.whatsapp.com/send/?phone=${
                  pedido.Whatsapp
                }&text=${encodeURIComponent(mensaje)}`;
                return (
                  <tr key={index} style={atendidos[pedido["ID Pedido"]] ? { background: "#e0ffe0" } : {}}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!atendidos[pedido["ID Pedido"]]}
                        onChange={() => handleCheck(pedido["ID Pedido"])}
                      />
                    </td>
                    <td>{pedido["ID Pedido"]}</td>
                    <td>{pedido.Cliente}</td>
                    <td>${pedido.Monto}</td>
                    <td>{pedido.TN}</td>
                    <td>{pedido["Estado Correo"]}</td>
                    <td>{pedido.Whatsapp}</td>
                    <td>
                      {pedido.Whatsapp ? (
                        <a
                          href={urlWhatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button>Enviar mensaje</button>
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
