function generarBoletoVisual(selecciones, monto, cuotaTotal) {
    document.getElementById('modal-ticket').style.display = 'flex';
    document.getElementById('ticket-id').innerText = `ID: #${Math.floor(Math.random()*900000)}`;
    document.getElementById('ticket-fecha').innerText = new Date().toLocaleString();
    document.getElementById('t-cuota').innerText = cuotaTotal.toFixed(2);
    document.getElementById('t-ganancia').innerText = (monto * cuotaTotal).toFixed(2) + " RC";
    
    const container = document.getElementById('ticket-events');
    container.innerHTML = selecciones.map(s => `
        <div style="background:#333; padding:10px; border-radius:10px; margin-bottom:5px;">
            <div style="font-size:10px; color:gray;">${s.torneo}</div>
            <div style="font-weight:bold;">${s.local} vs ${s.visitante}</div>
            <div style="color:var(--rani-verde);">Selección: ${s.opcion} @${s.cuota}</div>
        </div>
    `).join('');
}
