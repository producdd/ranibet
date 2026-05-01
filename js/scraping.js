async function cargarMercados(filtroLiga = 'Todos') {
    const container = document.getElementById('listado');
    const res = await fetch('https://gist.githubusercontent.com/producdd/c2669797958b72d635a0ab8430560c93/raw/partidos.json');
    const data = await res.json();
    
    container.innerHTML = '';
    const partidosFiltrados = filtroLiga === 'Todos' ? data : data.filter(p => p.torneo.includes(filtroLiga));

    partidosFiltrados.forEach(p => {
        const esEnVivo = p.estado === 'En Vivo' || p.en_vivo === true;
        container.innerHTML += `
            <div class="card" style="background:white; padding:15px; border-radius:15px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-size:11px; font-weight:bold; color:gray;">${p.torneo}</span>
                    <span style="font-size:11px; font-weight:600;">
                        ${esEnVivo ? '<span class="badge-live">EN VIVO</span>' : '🕒 ' + p.hora}
                    </span>
                </div>
                <div style="text-align:center; margin-bottom:15px; font-weight:800;">
                    ${p.local} <span style="color:var(--rani-verde);">VS</span> ${p.visitante}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div class="cuota-box" onclick="seleccionarAlCupon('${p.local}', 1.85, '${p.local} vs ${p.visitante}')">
                        <span class="cuota-name">${p.local}</span>
                        <span class="cuota-val">1.85</span>
                    </div>
                    <div class="cuota-box" onclick="seleccionarAlCupon('Empate', 3.20, '${p.local} vs ${p.visitante}')">
                        <span class="cuota-name">Empate</span>
                        <span class="cuota-val">3.20</span>
                    </div>
                    <div class="cuota-box" onclick="seleccionarAlCupon('${p.visitante}', 2.40, '${p.local} vs ${p.visitante}')">
                        <span class="cuota-name">${p.visitante}</span>
                        <span class="cuota-val">2.40</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function seleccionarAlCupon(opcion, cuota, evento) {
    document.getElementById('slip-empty').style.display = 'none';
    document.getElementById('slip-active').style.display = 'block';
    document.getElementById('sel-info').innerHTML = `<b>${evento}</b><br>Gana: ${opcion} @${cuota}`;
    window.currentSelection = { opcion, cuota, evento };
    actualizarCalculo();
}

function actualizarCalculo() {
    const monto = document.getElementById('monto-apuesta').value;
    const ganancia = monto * window.currentSelection.cuota;
    document.getElementById('pos-ganancia').innerText = ganancia.toFixed(2) + " RC";
}

cargarMercados();
