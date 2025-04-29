// Dashboard component with summary cards
function Dashboard({ ordersData, paymentsData }) {
  // Compute summary sums from ordersData and paymentsData
  const summarySums = useMemo(() => {
    // Initialize all needed keys with 0
    const sums = {
      'PESANAN.Order': 0,
      'PESANAN.PCS': 0,
      'CANCEL.Order': 0, 
      'CANCEL.PCS': 0,
      'FIX TERBELI.Order': 0,
      'FIX TERBELI.PCS': 0,
      'TERKIRIM.Order': 0,
      'TERKIRIM.PCS': 0,
      'AKAN DIKIRIM.Order': 0,
      'AKAN DIKIRIM.PCS': 0,
      'SUDAH CAIR.Order': 0,
      'SUDAH CAIR.PCS': 0,
      'BELUM CAIR.Order': 0,
      'BELUM CAIR.PCS': 0,
      'LABA KOTOR': 0,
      'LABA BERSIH': 0,
      'Pengembalian.Order': 0,
      'Pengembalian.PCS': 0,
      'RETURN.Order': 0,
      'RETURN.PCS': 0,
      'ESTIMASI': 0,
      'AFFILIASI.Nominal': 0,
      'AFFILIASI.Presentase': 0,
      'COD.Jumlah': 0,
      'COD.Presentase': 0
    };

    // Map payments by Order/adjustment ID for quick lookup
    const normalizedPayments = paymentsData.map(row => {
      const newRow = {};
      Object.entries(row).forEach(([k, v]) => newRow[k.trim()] = v);
      return newRow;
    });
    
    const paymentsByOrderId = new Map();
    normalizedPayments.forEach(p => {
      const orderIdKey = Object.keys(p).find(k => k.toLowerCase() === 'order/adjustment id');
      const orderId = orderIdKey ? p[orderIdKey] : '';
      if (!orderId) return;
      if (!paymentsByOrderId.has(orderId)) paymentsByOrderId.set(orderId, []);
      paymentsByOrderId.get(orderId).push(p);
    });

    // Group orders by Order ID
    const ordersGroupedById = new Map();
    ordersData.forEach(order => {
      const orderId = order['Order ID'] || '';
      if (!orderId) return;
      if (!ordersGroupedById.has(orderId)) ordersGroupedById.set(orderId, []);
      ordersGroupedById.get(orderId).push(order);
    });

    // Process each order group
    ordersGroupedById.forEach((orders, orderId) => {
      const order = orders[0];
      
      // Sum quantity for this order group
      let totalQuantity = 0;
      orders.forEach(o => {
        const qRaw = o['Quantity'];
        const q = typeof qRaw === 'string' ? parseInt(qRaw.replace(/\D/g, ''), 10) : Number(qRaw);
        if (!isNaN(q)) totalQuantity += q;
      });

      const statusOrder = (order['Order Status'] || '').toLowerCase();
      const paymentMethod = (order['Payment Method'] || '').toLowerCase();

      // Payments for this order
      const paymentsForOrder = paymentsByOrderId.get(orderId) || [];
      let totalSettlementAmount = 0;
      let totalAffiliateCommission = 0;
      paymentsForOrder.forEach(p => {
        const tsa = parseFloat(p['Total settlement amount']);
        if (!isNaN(tsa)) totalSettlementAmount += tsa;
        const aff = parseFloat(p['Affiliate commission']);
        if (!isNaN(aff)) totalAffiliateCommission += aff;
      });

      // PESANAN
      sums['PESANAN.Order'] += 1;
      sums['PESANAN.PCS'] += totalQuantity;

      // CANCEL
      if (statusOrder.startsWith('cancel') || statusOrder === 'canceled' || statusOrder === 'cancelled') {
        sums['CANCEL.Order'] += 1;
        sums['CANCEL.PCS'] += totalQuantity;
      }

      // FIX TERBELI (completed, shipped, to ship)
      if (['completed', 'shipped', 'to ship'].includes(statusOrder)) {
        sums['FIX TERBELI.Order'] += 1;
        sums['FIX TERBELI.PCS'] += totalQuantity;
      }

      // TERKIRIM (shipped)
      if (statusOrder === 'shipped') {
        sums['TERKIRIM.Order'] += 1;
        sums['TERKIRIM.PCS'] += totalQuantity;
      }

      // AKAN DIKIRIM (to ship)
      if (statusOrder === 'to ship') {
        sums['AKAN DIKIRIM.Order'] += 1;
        sums['AKAN DIKIRIM.PCS'] += totalQuantity;
      }

      // SUDAH CAIR (totalSettlementAmount > 0)
      if (totalSettlementAmount > 0) {
        sums['SUDAH CAIR.Order'] += 1;
        sums['SUDAH CAIR.PCS'] += totalQuantity;
      }

      // BELUM CAIR (totalSettlementAmount <= 0)
      if (totalSettlementAmount <= 0) {
        sums['BELUM CAIR.Order'] += 1;
        sums['BELUM CAIR.PCS'] += totalQuantity;
      }

      // LABA KOTOR & LABA BERSIH
      sums['LABA KOTOR'] += totalSettlementAmount;
      sums['LABA BERSIH'] += totalSettlementAmount;

      // Pengembalian
      if (statusOrder === 'pengembalian') {
        sums['Pengembalian.Order'] += 1;
        sums['Pengembalian.PCS'] += totalQuantity;
      }

      // Return
      if (statusOrder === 'return') {
        sums['RETURN.Order'] += 1;
        sums['RETURN.PCS'] += totalQuantity;
      }

      // AFFILIASI Nominal
      sums['AFFILIASI.Nominal'] += totalAffiliateCommission;

      // COD Jumlah
      if (paymentMethod === 'bayar di tempat') {
        sums['COD.Jumlah'] += 1;
      }
    });

    // ESTIMASI is 0 as modal not included
    sums['ESTIMASI'] = 0;

    // Calculate percentages
    const totalOrders = sums['PESANAN.Order'] || 0;
    
    // AFFILIASI Presentase = (jumlah order affiliasi YA) / total order * 100
    let affiliasiYACount = 0;
    ordersGroupedById.forEach((orders, orderId) => {
      const paymentsForOrder = paymentsByOrderId.get(orderId) || [];
      let totalAffiliateCommission = 0;
      paymentsForOrder.forEach(p => {
        const aff = parseFloat(p['Affiliate commission']);
        if (!isNaN(aff)) totalAffiliateCommission += aff;
      });
      if (totalAffiliateCommission > 0) affiliasiYACount++;
    });
    sums['AFFILIASI.Presentase'] = totalOrders > 0 ? (affiliasiYACount / totalOrders) * 100 : 0;

    // COD Presentase = (jumlah order bayar di tempat) / total order * 100
    sums['COD.Presentase'] = totalOrders > 0 ? (sums['COD.Jumlah'] / totalOrders) * 100 : 0;

    return sums;
  }, [ordersData, paymentsData]);

  // Cards to display with header and sub-header mapping to summarySums keys
  const cardsInfo = [
    { key: 'PESANAN.Order', label: 'Pesanan', icon: 'fas fa-box', isText: false, subKey: 'PESANAN.PCS', subLabel: 'PCS' },
    { key: 'CANCEL.Order', label: 'Cancel', icon: 'fas fa-ban', isText: false, subKey: 'CANCEL.PCS', subLabel: 'PCS' },
    { key: 'FIX TERBELI.Order', label: 'Fix Terbeli', icon: 'fas fa-check-circle', isText: false, subKey: 'FIX TERBELI.PCS', subLabel: 'PCS' },
    { key: 'TERKIRIM.Order', label: 'Terkirim', icon: 'fas fa-truck', isText: false, subKey: 'TERKIRIM.PCS', subLabel: 'PCS' },
    { key: 'AKAN DIKIRIM.Order', label: 'Akan Dikirim', icon: 'fas fa-clock', isText: false, subKey: 'AKAN DIKIRIM.PCS', subLabel: 'PCS' },
    { key: 'SUDAH CAIR.Order', label: 'Sudah Cair', icon: 'fas fa-wallet', isText: false, subKey: 'SUDAH CAIR.PCS', subLabel: 'PCS' },
    { key: 'BELUM CAIR.Order', label: 'Belum Cair', icon: 'fas fa-hourglass-start', isText: false, subKey: 'BELUM CAIR.PCS', subLabel: 'PCS' },
    { key: 'LABA KOTOR', label: 'Laba Kotor', icon: 'fas fa-dollar-sign', isText: false },
    { key: 'LABA BERSIH', label: 'Laba Bersih', icon: 'fas fa-money-bill-wave', isText: false },
    { key: 'Pengembalian.Order', label: 'Pengembalian', icon: 'fas fa-undo', isText: false, subKey: 'Pengembalian.PCS', subLabel: 'PCS' },
    { key: 'RETURN.Order', label: 'Return', icon: 'fas fa-undo-alt', isText: false, subKey: 'RETURN.PCS', subLabel: 'PCS' },
    { key: 'ESTIMASI', label: 'Estimasi', icon: 'fas fa-calculator', isText: false },
    { key: 'AFFILIASI.Nominal', label: 'Affiliasi', icon: 'fas fa-handshake', isText: false, subKey: 'AFFILIASI.Presentase', subLabel: 'Presentase', isSubText: true },
    { key: 'COD.Jumlah', label: 'COD', icon: 'fas fa-money-check-alt', isText: false, subKey: 'COD.Presentase', subLabel: 'Presentase', isSubText: true }
  ];

  return (
    <main className="max-w-full p-4 sm:p-6 lg:p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {cardsInfo.map(({ key, label, icon, isText, subKey, subLabel, isSubText }) => {
          let mainValue = summarySums[key];
          if (mainValue === undefined || mainValue === null) mainValue = '-';
          
          if (!isText && typeof mainValue === 'string' && mainValue !== '-' && !mainValue.toString().includes('%')) {
            const numVal = Number(mainValue.toString().replace(/\./g, '').replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numVal)) {
              if (key === 'LABA KOTOR' || key === 'LABA BERSIH' || key === 'ESTIMASI' || key === 'AFFILIASI.Nominal') {
                mainValue = formatRupiah(numVal);
              } else {
                mainValue = numVal.toLocaleString('id-ID');
              }
            }
          } else if (typeof mainValue === 'number') {
            if (key === 'LABA KOTOR' || key === 'LABA BERSIH' || key === 'ESTIMASI' || key === 'AFFILIASI.Nominal') {
              mainValue = formatRupiah(mainValue);
            } else {
              mainValue = mainValue.toLocaleString('id-ID');
            }
          }

          let subValue = null;
          if (subKey) {
            subValue = summarySums[subKey];
            if (subValue === undefined || subValue === null) subValue = '-';
            
            if (!isSubText && typeof subValue === 'string' && subValue !== '-' && !subValue.toString().includes('%')) {
              const numSubVal = Number(subValue.toString().replace(/\./g, '').replace(/[^0-9.-]+/g, ''));
              if (!isNaN(numSubVal)) {
                if (subKey === 'LABA KOTOR' || subKey === 'LABA BERSIH' || subKey === 'ESTIMASI' || subKey === 'AFFILIASI.Nominal') {
                  subValue = formatRupiah(numSubVal);
                } else {
                  subValue = numSubVal.toLocaleString('id-ID');
                }
              }
            } else if (typeof subValue === 'number' && !isSubText) {
              if (subKey === 'LABA KOTOR' || subKey === 'LABA BERSIH' || subKey === 'ESTIMASI' || subKey === 'AFFILIASI.Nominal') {
                subValue = formatRupiah(subValue);
              } else {
                subValue = subValue.toLocaleString('id-ID');
              }
            }
            
            // For sub text values that are percentages, keep as is
            if (isSubText && typeof subValue === 'number') {
              subValue = subValue.toFixed(2) + '%';
            }
          }

          return (
            <div key={key} className="bg-white rounded-lg shadow p-5 flex flex-col space-y-2">
              <div className="flex items-center justify-between space-x-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">{label}</p>
                  <p className="text-xl font-semibold text-gray-900 truncate" title={mainValue}>{mainValue}</p>
                </div>
                <div className="flex-shrink-0 text-indigo-600 text-3xl">
                  <i className={icon} aria-hidden="true"></i>
                </div>
              </div>
              {subKey && (
                <div className="pl-0">
                  <p className="text-xs font-semibold text-gray-400 inline">{subLabel}: </p>
                  <p className="text-sm font-semibold text-gray-700 truncate inline" title={subValue}> {subValue}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
