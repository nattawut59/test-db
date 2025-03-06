// ตรวจสอบการโหลด Chart.js และแก้ไขปัญหาที่เกี่ยวข้อง
document.addEventListener('DOMContentLoaded', function() {
    // ตรวจสอบว่าโหลด Chart.js สำเร็จหรือไม่
    if (typeof Chart === 'undefined') {
        console.error('ไม่พบ Chart.js กำลังโหลด Chart.js จาก CDN');
        
        // โหลด Chart.js ถ้าไม่มี
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js';
        script.integrity = 'sha512-QSkVNOCYLtj73J4hbmVoOV6KVZuMluZlioC+trLpewV8qMjsWqlIQvkn1KGX2StWvPMdWGBqim1xlC8krl1EKQ==';
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        
        script.onload = function() {
            console.log('โหลด Chart.js สำเร็จ');
            
            // ตรวจสอบว่าแท็บแดชบอร์ดเปิดอยู่หรือไม่
            if (document.getElementById('dashboardSection')?.classList.contains('active')) {
                console.log('แท็บแดชบอร์ดกำลังแสดงอยู่ กำลังเรนเดอร์กราฟ...');
                setTimeout(renderDashboardCharts, 500);
            }
        };
        
        script.onerror = function() {
            console.error('ไม่สามารถโหลด Chart.js ได้');
            showAlert('error', 'ไม่สามารถโหลดไลบรารีสำหรับแสดงกราฟได้');
            
            // แสดงข้อความแจ้งเตือนในพื้นที่กราฟ
            ['timeDistributionChart', 'adherenceChart', 'dailyLogsChart'].forEach(chartId => {
                const canvas = document.getElementById(chartId);
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    canvas.height = 150;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = '16px Sarabun';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#757575';
                    ctx.fillText('ไม่สามารถโหลดไลบรารีสำหรับแสดงกราฟได้', canvas.width / 2, canvas.height / 2);
                }
            });
        };
        
        document.head.appendChild(script);
    } else {
        console.log('มี Chart.js อยู่แล้ว');
        
        // ตรวจสอบว่าแท็บแดชบอร์ดเปิดอยู่หรือไม่
        if (document.getElementById('dashboardSection')?.classList.contains('active')) {
            console.log('แท็บแดชบอร์ดกำลังแสดงอยู่ กำลังเรนเดอร์กราฟ...');
            setTimeout(renderDashboardCharts, 500);
        }
    }
    
    // เพิ่ม event listener เมื่อคลิกแท็บแดชบอร์ด
    const dashboardTab = document.querySelector('.tab[onclick="showSection(\'dashboard\')"]');
    if (dashboardTab) {
        dashboardTab.addEventListener('click', function() {
            console.log('คลิกแท็บแดชบอร์ด กำลังเรนเดอร์กราฟ...');
            setTimeout(renderDashboardCharts, 500);
        });
    }
    
    // เพิ่มการตรวจสอบความพร้อมของ canvas elements
    function checkCanvasElements() {
        const canvasIds = ['timeDistributionChart', 'adherenceChart', 'dailyLogsChart'];
        let allCanvasReady = true;
        
        canvasIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas) {
                console.warn(`ไม่พบ canvas element: ${id}`);
                allCanvasReady = false;
            }
        });
        
        return allCanvasReady;
    }
    
    // เพิ่มตัวตรวจจับการเปลี่ยนแปลง DOM เพื่อตรวจสอบ canvas
    if (!checkCanvasElements()) {
        const observer = new MutationObserver(function(mutations) {
            if (checkCanvasElements()) {
                console.log('พบ canvas elements ทั้งหมดแล้ว');
                observer.disconnect();
                
                // ตรวจสอบอีกครั้งว่าแท็บแดชบอร์ดเปิดอยู่หรือไม่
                if (document.getElementById('dashboardSection')?.classList.contains('active')) {
                    console.log('แท็บแดชบอร์ดกำลังแสดงอยู่ กำลังเรนเดอร์กราฟหลังพบ canvas...');
                    setTimeout(renderDashboardCharts, 500);
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
});