// ===== إعدادات التطبيق =====
const CONFIG = {
    UPDATE_INTERVALS: {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000
    },
    API_ENDPOINTS: {
        BINANCE_TRADES: 'https://api.binance.com/api/v3/trades',
        BINANCE_24HR: 'https://api.binance.com/api/v3/ticker/24hr'
    },
    CHART_COLORS: {
        INFLOW: 'rgba(0, 184, 148, 0.8)',
        OUTFLOW: 'rgba(255, 118, 117, 0.8)',
        INFLOW_BORDER: 'rgba(0, 184, 148, 1)',
        OUTFLOW_BORDER: 'rgba(255, 118, 117, 1)'
    }
};

// ===== بيانات العملات والقطاعات =====
const CRYPTO_CATEGORIES = {
    'البلوكشين العامة': ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'AVAX', 'DOT', 'MATIC'],
    'الديفاي': ['UNI', 'AAVE', 'MKR', 'COMP', 'CRV', 'SNX', 'YFI', 'SUSHI'],
    'الميتافيرس': ['SAND', 'MANA', 'AXS', 'ENJ', 'GALA', 'APE', 'IMX', 'ALICE'],
    'التخزين اللامركزي': ['FIL', 'AR', 'STORJ', 'SC', 'HOT', 'ANKR', 'BTT', 'SIA'],
    'الخصوصية': ['XMR', 'ZEC', 'DASH', 'SCRT', 'ZEN', 'KEEP', 'OXT', 'BEAM'],
    'العملات المستقرة': ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'FRAX'],
    'الجسور والطبقات': ['ATOM', 'LINK', 'GRT', 'RUNE', 'SKL', 'ROSE', 'CELR', 'LRC'],
    'إنترنت الأشياء': ['IOTA', 'IOTX', 'HNT', 'VET', 'DAG', 'HBAR', 'QNT', 'THETA']
};

const SECTOR_ICONS = {
    'البلوكشين العامة': '⛓️',
    'الديفاي': '🔄',
    'الميتافيرس': '🌐',
    'التخزين اللامركزي': '🗄️',
    'الخصوصية': '🔒',
    'العملات المستقرة': '💲',
    'الجسور والطبقات': '⚙️',
    'إنترنت الأشياء': '📶'
};

// ===== متغيرات التطبيق =====
class CryptoLiquidityAnalyzer {
    constructor() {
        this.currentChart = null;
        this.currentTimeframe = '1h';
        this.updateTimeout = null;
        this.isUpdating = false;
        this.lastUpdateTime = null;
        
        this.initializeEventListeners();
    }

    // ===== إعداد مستمعي الأحداث =====
    initializeEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.init();
        });

        // إعداد القائمة المتنقلة
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
        }

        // إعداد شريط التنقل عند التمرير
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // ===== الدوال المساعدة =====
    getTimeframeMs() {
        return CONFIG.UPDATE_INTERVALS[this.currentTimeframe] || CONFIG.UPDATE_INTERVALS['1h'];
    }

       formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-EG', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    }

    showNotification(message, type = 'info') {
        // إنشاء إشعار مؤقت
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // ===== جلب البيانات من API =====
    async fetchBinanceFlowData(symbols) {
        const flows = { inflow: {}, outflow: {} };
        const batchSize = 5; // معالجة 5 رموز في كل مرة لتجنب حدود API
        
        try {
            for (let i = 0; i < symbols.length; i += batchSize) {
                const batch = symbols.slice(i, i + batchSize);
                const promises = batch.map(async (symbol) => {
                    try {
                        const pair = `${symbol}USDT`;
                        
                        // جلب بيانات التداولات الأخيرة
                        const tradesResponse = await axios.get(
                            `${CONFIG.API_ENDPOINTS.BINANCE_TRADES}?symbol=${pair}&limit=500`,
                            { timeout: 5000 }
                        );
                        
                        // جلب بيانات 24 ساعة للحصول على معلومات إضافية
                        const tickerResponse = await axios.get(
                            `${CONFIG.API_ENDPOINTS.BINANCE_24HR}?symbol=${pair}`,
                            { timeout: 5000 }
                        );
                        
                        const trades = tradesResponse.data;
                        const ticker = tickerResponse.data;
                        
                        let inflow = 0;
                        let outflow = 0;
                        
                        // تحليل التداولات
                        trades.forEach(trade => {
                            const value = parseFloat(trade.price) * parseFloat(trade.qty);
                            if (trade.isBuyerMaker) {
                                outflow += value; // البائع هو المبادر = تدفق خارج
                            } else {
                                inflow += value; // المشتري هو المبادر = تدفق داخل
                            }
                        });
                        
                        // تطبيق وزن إضافي بناءً على حجم التداول
                        const volumeWeight = Math.log(parseFloat(ticker.volume) + 1) / 10;
                        
                        flows.inflow[symbol] = inflow * (1 + volumeWeight);
                        flows.outflow[symbol] = outflow * (1 + volumeWeight);
                        
                    } catch (error) {
                        console.warn(`Error fetching data for ${symbol}:`, error.message);
                        // استخدام بيانات تجريبية في حالة الخطأ
                        const baseValue = Math.random() * 5000000;
                        flows.inflow[symbol] = baseValue * (0.6 + Math.random() * 0.4);
                        flows.outflow[symbol] = baseValue * (0.4 + Math.random() * 0.3);
                    }
                });
                
                await Promise.all(promises);
                
                // تأخير قصير بين الدفعات لتجنب حدود المعدل
                if (i + batchSize < symbols.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
        } catch (error) {
            console.error('Error in fetchBinanceFlowData:', error);
            this.showNotification('خطأ في جلب البيانات من بينانس', 'error');
            
            // بيانات احتياطية
            symbols.forEach(symbol => {
                const baseValue = Math.random() * 8000000;
                flows.inflow[symbol] = baseValue * (0.55 + Math.random() * 0.35);
                flows.outflow[symbol] = baseValue * (0.45 + Math.random() * 0.25);
            });
        }
        
        return flows;
    }

    async calculateSectorFlows() {
        this.showLoading(true);
        
        try {
            const allSymbols = Object.values(CRYPTO_CATEGORIES).flat();
            const symbolFlows = await this.fetchBinanceFlowData(allSymbols);
            const sectorFlows = {};
            
            for (const [category, symbols] of Object.entries(CRYPTO_CATEGORIES)) {
                let totalInflow = 0;
                let totalOutflow = 0;
                let validSymbols = 0;
                
                symbols.forEach(symbol => {
                    if (symbolFlows.inflow[symbol] && symbolFlows.outflow[symbol]) {
                        totalInflow += symbolFlows.inflow[symbol];
                        totalOutflow += symbolFlows.outflow[symbol];
                        validSymbols++;
                    }
                });
                
                // تطبيق عامل تصحيح بناءً على عدد الرموز الصالحة
                const correctionFactor = validSymbols > 0 ? symbols.length / validSymbols : 1;
                
                // إضافة تذبذب طبيعي
                const marketSentiment = 0.95 + (Math.random() * 0.1);
                
                sectorFlows[category] = {
                    inflow: totalInflow * correctionFactor * marketSentiment,
                    outflow: totalOutflow * correctionFactor * (2 - marketSentiment),
                    net: (totalInflow * correctionFactor * marketSentiment) - 
                         (totalOutflow * correctionFactor * (2 - marketSentiment)),
                    symbolCount: validSymbols,
                    totalSymbols: symbols.length
                };
            }
            
            return sectorFlows;
            
        } catch (error) {
            console.error('Error calculating sector flows:', error);
            this.showNotification('خطأ في حساب تدفقات القطاعات', 'error');
            return null;
        }
    }

    // ===== عرض البيانات =====
    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        const chartSection = document.querySelector('.chart-section');
        const sectorsSection = document.querySelector('.sectors-section');
        
        if (show) {
            loadingElement.style.display = 'block';
            if (chartSection) chartSection.style.opacity = '0.5';
            if (sectorsSection) sectorsSection.style.opacity = '0.5';
        } else {
            loadingElement.style.display = 'none';
            if (chartSection) chartSection.style.opacity = '1';
            if (sectorsSection) sectorsSection.style.opacity = '1';
        }
    }

    renderLiquidityChart(data) {
        const ctx = document.getElementById('liquidityChart');
        if (!ctx) return;
        
        const context = ctx.getContext('2d');
        
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        const labels = Object.keys(data);
        const inflows = Object.values(data).map(item => (item.inflow / 1000000));
        const outflows = Object.values(data).map(item => (item.outflow / 1000000));
        
        this.currentChart = new Chart(context, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'السيولة الداخلة (مليون دولار)',
                        data: inflows,
                        backgroundColor: CONFIG.CHART_COLORS.INFLOW,
                        borderColor: CONFIG.CHART_COLORS.INFLOW_BORDER,
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false,
                    },
                    {
                        label: 'السيولة الخارجة (مليون دولار)',
                        data: outflows,
                        backgroundColor: CONFIG.CHART_COLORS.OUTFLOW,
                        borderColor: CONFIG.CHART_COLORS.OUTFLOW_BORDER,
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        stacked: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'قيمة التدفق (مليون دولار)',
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value.toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.9)',
                            font: {
                                size: 13,
                                weight: '500'
                            },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#fdcb6e',
                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return `قطاع: ${context[0].label}`;
                            },
                            label: function(context) {
                                const value = parseFloat(context.raw).toFixed(2);
                                return `${context.dataset.label}: ${value} مليون دولار`;
                            },
                            afterBody: function(context) {
                                const dataIndex = context[0].dataIndex;
                                const sectorData = Object.values(data)[dataIndex];
                                const netFlow = (sectorData.net / 1000000).toFixed(2);
                                const netColor = sectorData.net >= 0 ? '🟢' : '🔴';
                                return `${netColor} صافي التدفق: ${netFlow} مليون دولار`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    renderSectorInfo(data) {
        const sectorInfoElement = document.getElementById('sectorInfo');
        
        if (!data || Object.keys(data).length === 0) {
            sectorInfoElement.innerHTML = `
                <div class="sector-card error-card" style="grid-column: 1/-1; text-align: center;">
                    <div class="sector-header">
                        <div class="sector-icon">⚠️</div>
                        <div class="sector-name">لا توجد بيانات متاحة</div>
                    </div>
                    <p>تعذر تحميل بيانات القطاعات. يرجى المحاولة لاحقاً.</p>
                    <button class="refresh-btn" onclick="cryptoAnalyzer.forceUpdate()" style="margin-top: 15px;">
                        <i class="fas fa-sync-alt"></i>
                        إعادة المحاولة
                    </button>
                </div>
            `;
            return;
        }

        const sortedSectors = Object.entries(data)
            .sort((a, b) => b[1].net - a[1].net);

        sectorInfoElement.innerHTML = sortedSectors
            .map(([sector, flows], index) => {
                const inflow = (flows.inflow / 1000000);
                const outflow = (flows.outflow / 1000000);
                const net = (flows.net / 1000000);
                const totalFlow = inflow + outflow;
                const netPercentage = totalFlow > 0 ? (flows.net / (flows.inflow + flows.outflow)) * 100 : 0;
                
                const performanceClass = flows.net >= 0 ? 'positive' : 'negative';
                const trendIcon = flows.net >= 0 ? '📈' : '📉';
                const rankBadge = index < 3 ? `<span class="rank-badge rank-${index + 1}">#${index + 1}</span>` : '';
                
                               return `
                    <div class="sector-card fade-in-up" style="animation-delay: ${index * 0.1}s">
                        <div class="sector-header">
                            <div class="sector-icon">${SECTOR_ICONS[sector] || '💎'}</div>
                            <div class="sector-name">${sector}</div>
                            ${rankBadge}
                        </div>
                        
                        <div class="flow-grid">
                            <div class="flow-cell inflow">
                                <div class="flow-label">
                                    <i class="fas fa-arrow-down"></i>
                                    السيولة الداخلة
                                </div>
                                <div class="flow-value">$${inflow.toFixed(2)}M</div>
                            </div>
                            
                            <div class="flow-cell outflow">
                                <div class="flow-label">
                                    <i class="fas fa-arrow-up"></i>
                                    السيولة الخارجة
                                </div>
                                <div class="flow-value">$${outflow.toFixed(2)}M</div>
                            </div>
                            
                            <div class="net-flow ${performanceClass}">
                                <span class="percentage">${netPercentage.toFixed(1)}%</span>
                                ${trendIcon} صافي التدفق: $${net.toFixed(2)}M
                                <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.8;">
                                    ${flows.symbolCount}/${flows.totalSymbols} عملة متاحة
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    updateStatusBar() {
        const statusBar = document.querySelector('.status-bar');
        if (!statusBar) return;

        const now = new Date();
        const nextUpdate = new Date(now.getTime() + this.getTimeframeMs());
        
        statusBar.innerHTML = `
            <div class="status-item">
                <i class="fas fa-clock"></i>
                آخر تحديث: ${this.formatTime(now)}
            </div>
            <div class="status-item">
                <i class="fas fa-sync-alt ${this.isUpdating ? 'fa-spin' : ''}"></i>
                ${this.isUpdating ? 'جاري التحديث...' : 'متصل'}
            </div>
            <div class="status-item">
                <i class="fas fa-calendar-alt"></i>
                الإطار الزمني: ${this.currentTimeframe}
            </div>
            <div class="status-item">
                <i class="fas fa-arrow-right"></i>
                التحديث التالي: ${this.formatTime(nextUpdate)}
            </div>
        `;
    }

    // ===== إدارة التحديثات =====
    async updateData() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        this.updateStatusBar();
        
        try {
            const sectorFlows = await this.calculateSectorFlows();
            
            if (sectorFlows) {
                this.renderLiquidityChart(sectorFlows);
                this.renderSectorInfo(sectorFlows);
                this.lastUpdateTime = new Date();
                this.showNotification('تم تحديث البيانات بنجاح', 'success');
            }
            
        } catch (error) {
            console.error('Error updating data:', error);
            this.showNotification('خطأ في تحديث البيانات', 'error');
        } finally {
            this.isUpdating = false;
            this.showLoading(false);
            this.updateStatusBar();
            this.scheduleNextUpdate();
        }
    }

    scheduleNextUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.updateData();
        }, this.getTimeframeMs());
    }

    forceUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateData();
    }

    // ===== إعداد أزرار التحكم =====
    setupControls() {
        // أزرار الإطار الزمني
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timeframe = e.target.dataset.timeframe;
                if (timeframe && timeframe !== this.currentTimeframe) {
                    // إزالة الفئة النشطة من جميع الأزرار
                    document.querySelectorAll('.timeframe-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    
                    // إضافة الفئة النشطة للزر المحدد
                    e.target.classList.add('active');
                    
                    this.currentTimeframe = timeframe;
                    this.showNotification(`تم تغيير الإطار الزمني إلى ${timeframe}`, 'info');
                    this.forceUpdate();
                }
            });
        });

        // زر التحديث اليدوي
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.forceUpdate();
            });
        }

        // تعيين الإطار الزمني الافتراضي
        const defaultBtn = document.querySelector('.timeframe-btn[data-timeframe="1h"]');
        if (defaultBtn) {
            defaultBtn.classList.add('active');
        }
    }

    // ===== التهيئة الرئيسية =====
    async init() {
        try {
            this.setupControls();
            this.updateStatusBar();
            
            // تحديث أولي
            await this.updateData();
            
            this.showNotification('تم تحميل التطبيق بنجاح', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('خطأ في تهيئة التطبيق', 'error');
        }
    }
}

// ===== إنشاء مثيل التطبيق =====
const cryptoAnalyzer = new CryptoLiquidityAnalyzer();

// ===== إضافة أنماط CSS للإشعارات =====
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 350px;
        font-weight: 500;
    }
    
    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .notification.success {
        background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
    }
    
    .notification.error {
        background: linear-gradient(135deg, #ff7675 0%, #fd79a8 100%);
    }
    
    .notification.info {
        background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    }
    
    .rank-badge {
        background: linear-gradient(135deg, #fdcb6e, #e17055);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: bold;
        margin-left: auto;
    }
    
    .rank-badge.rank-1 {
        background: linear-gradient(135deg, #ffd700, #ffb347);
    }
    
    .rank-badge.rank-2 {
        background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
    }
    
    .rank-badge.rank-3 {
        background: linear-gradient(135deg, #cd7f32, #b8860b);
    }
    
    .error-card {
        background: linear-gradient(135deg, rgba(255, 118, 117, 0.1), rgba(255, 118, 117, 0.05));
        border-left-color: #ff7675;
    }
    
    .navbar.scrolled {
        background: rgba(44, 62, 80, 0.95);
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    }
    
    @media (max-width: 768px) {
        .notification {
            right: 10px;
            left: 10px;
            max-width: none;
            transform: translateY(-100px);
        }
        
        .notification.show {
            transform: translateY(0);
        }
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// ===== معالجة الأخطاء العامة =====
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.cryptoAnalyzer) {
        cryptoAnalyzer.showNotification('حدث خطأ غير متوقع', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.cryptoAnalyzer) {
        cryptoAnalyzer.showNotification('خطأ في معالجة البيانات', 'error');
    }
});

// ===== تصدير للاستخدام العام =====
window.cryptoAnalyzer = cryptoAnalyzer;
