const Storage = {
    saveSaldo: (monto) => localStorage.setItem('rani_saldo', monto),
    getSaldo: () => parseFloat(localStorage.getItem('rani_saldo')) || 50,
    
    saveTicket: (ticket) => {
        let historial = JSON.parse(localStorage.getItem('rani_historial')) || [];
        historial.push(ticket);
        localStorage.setItem('rani_historial', JSON.stringify(historial));
    },
    
    getHistorial: () => JSON.parse(localStorage.getItem('rani_historial')) || []
};
