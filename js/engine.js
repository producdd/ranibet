let saldoActual = Storage.getSaldo();
let apuestasActivas = [];

function procesarApuestaAutomatica(selecciones, monto) {
    const cuotaTotal = selecciones.reduce((acc, curr) => acc * curr.cuota, 1);
    const nuevoTicket = {
        id: Math.floor(Math.random() * 1000000),
        eventos: selecciones,
        monto: monto,
        cuota: cuotaTotal,
        estado: 'Pendiente',
        fecha: new Date().toISOString()
    };

    saldoActual -= monto;
    Storage.saveSaldo(saldoActual);
    Storage.saveTicket(nuevoTicket);
    actualizarInterfazSaldo();
    
    // Iniciar el chequeo automático cada 30 segundos
    verificarResultados(nuevoTicket);
}

async function verificarResultados(ticket) {
    // Jalamos la data fresca de tu scraping
    const res = await fetch('https://gist.githubusercontent.com/producdd/c2669797958b72d635a0ab8430560c93/raw/partidos.json');
    const partidosReales = await res.json();

    let todosGanados = true;
    let algunTerminado = false;

    ticket.eventos.forEach(evApuesta => {
        const real = partidosReales.find(p => p.local === evApuesta.local && p.visitante === evApuesta.visitante);
        
        if (real && real.estado === 'Finalizado') {
            algunTerminado = true;
            // Lógica de goles de tu scraping
            const golesL = parseInt(real.goles_local);
            const golesV = parseInt(real.goles_visitante);
            
            let resultadoReal = 'Empate';
            if (golesL > golesV) resultadoReal = real.local;
            if (golesV > golesL) resultadoReal = real.visitante;

            if (evApuesta.opcion !== resultadoReal) todosGanados = false;
        } else {
            todosGanados = false; // Aún no termina
        }
    });

    if (todosGanados) {
        const premio = ticket.monto * ticket.cuota;
        saldoActual += premio;
        Storage.saveSaldo(saldoActual);
        alert(`¡Logro Cumplido! 🐸 Ganaste ${premio.toFixed(2)} Rani Coins`);
        actualizarInterfazSaldo();
    }
}

function actualizarInterfazSaldo() {
    document.getElementById('balance').innerText = saldoActual.toFixed(2);
}

// Cargar saldo inicial
actualizarInterfazSaldo();
