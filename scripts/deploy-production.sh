#!/bin/bash

# Production Deployment Script for Arbitrage Trading Bot
# This script sets up a production environment with all necessary components

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="arbitrage-bot"
APP_USER="arbitrage"
APP_GROUP="arbitrage"
APP_DIR="/opt/arbitrage-bot"
LOG_DIR="/var/log/arbitrage-bot"
SERVICE_NAME="arbitrage-bot"
NGINX_CONF="/etc/nginx/sites-available/arbitrage-bot"
NGINX_ENABLED="/etc/nginx/sites-enabled/arbitrage-bot"
SSL_DIR="/etc/letsencrypt/live/yourdomain.com"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    local missing_packages=()
    
    # Check for required packages
    if ! command_exists node; then
        missing_packages+=("node")
    fi
    
    if ! command_exists npm; then
        missing_packages+=("npm")
    fi
    
    if ! command_exists pm2; then
        missing_packages+=("pm2")
    fi
    
    if ! command_exists nginx; then
        missing_packages+=("nginx")
    fi
    
    if ! command_exists certbot; then
        missing_packages+=("certbot")
    fi
    
    if ! command_exists postgresql; then
        missing_packages+=("postgresql")
    fi
    
    if ! command_exists redis-server; then
        missing_packages+=("redis-server")
    fi
    
    if [ ${#missing_packages[@]} -ne 0 ]; then
        print_error "Missing required packages: ${missing_packages[*]}"
        print_status "Installing missing packages..."
        
        # Update package list
        sudo apt-get update
        
        # Install Node.js and npm
        if [[ " ${missing_packages[@]} " =~ " node " ]] || [[ " ${missing_packages[@]} " =~ " npm " ]]; then
            print_status "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        # Install PM2
        if [[ " ${missing_packages[@]} " =~ " pm2 " ]]; then
            print_status "Installing PM2..."
            sudo npm install -g pm2
        fi
        
        # Install Nginx
        if [[ " ${missing_packages[@]} " =~ " nginx " ]]; then
            print_status "Installing Nginx..."
            sudo apt-get install -y nginx
        fi
        
        # Install Certbot
        if [[ " ${missing_packages[@]} " =~ " certbot " ]]; then
            print_status "Installing Certbot..."
            sudo apt-get install -y certbot python3-certbot-nginx
        fi
        
        # Install PostgreSQL
        if [[ " ${missing_packages[@]} " =~ " postgresql " ]]; then
            print_status "Installing PostgreSQL..."
            sudo apt-get install -y postgresql postgresql-contrib
        fi
        
        # Install Redis
        if [[ " ${missing_packages[@]} " =~ " redis-server " ]]; then
            print_status "Installing Redis..."
            sudo apt-get install -y redis-server
        fi
        
        print_success "All required packages installed"
    else
        print_success "All required packages are already installed"
    fi
}

# Function to setup user and group
setup_user() {
    print_status "Setting up user and group..."
    
    # Create group if it doesn't exist
    if ! getent group $APP_GROUP >/dev/null 2>&1; then
        sudo groupadd $APP_GROUP
        print_success "Created group: $APP_GROUP"
    fi
    
    # Create user if it doesn't exist
    if ! id "$APP_USER" &>/dev/null; then
        sudo useradd -r -g $APP_GROUP -s /bin/bash -d $APP_DIR $APP_USER
        print_success "Created user: $APP_USER"
    fi
    
    # Add user to necessary groups
    sudo usermod -a -G sudo $APP_USER
    sudo usermod -a -G www-data $APP_USER
}

# Function to setup directories
setup_directories() {
    print_status "Setting up application directories..."
    
    # Create application directory
    sudo mkdir -p $APP_DIR
    sudo mkdir -p $LOG_DIR
    sudo mkdir -p $APP_DIR/logs
    sudo mkdir -p $APP_DIR/config
    sudo mkdir -p $APP_DIR/backups
    
    # Set ownership
    sudo chown -R $APP_USER:$APP_GROUP $APP_DIR
    sudo chown -R $APP_USER:$APP_GROUP $LOG_DIR
    
    # Set permissions
    sudo chmod 755 $APP_DIR
    sudo chmod 755 $LOG_DIR
    sudo chmod 755 $APP_DIR/logs
    sudo chmod 755 $APP_DIR/config
    sudo chmod 755 $APP_DIR/backups
    
    print_success "Directories created and permissions set"
}

# Function to install application
install_application() {
    print_status "Installing application..."
    
    # Copy application files
    sudo cp -r . $APP_DIR/
    sudo chown -R $APP_USER:$APP_GROUP $APP_DIR
    
    # Install dependencies
    cd $APP_DIR
    sudo -u $APP_USER npm ci --only=production
    
    print_success "Application installed successfully"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment configuration..."
    
    # Create .env file
    sudo -u $APP_USER tee $APP_DIR/.env > /dev/null <<EOF
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/arbitrage_bot
PG_MAX_CLIENTS=20
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECTION_TIMEOUT_MS=10000

# RPC Configuration
PRIMARY_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
FALLBACK_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_API_KEY
WEBSOCKET_RPC_URL=wss://mainnet.infura.io/ws/v3/YOUR_INFURA_PROJECT_ID
RPC_TIMEOUT=30000
RPC_RETRIES=3

# Arbitrage Configuration
MIN_PROFIT_THRESHOLD=0.01
MAX_SLIPPAGE=0.005
PROFIT_BUFFER=0.2
MAX_CONCURRENT_EXECUTIONS=5
EXECUTION_TIMEOUT=30000
RETRY_DELAY=5000
MAX_RETRIES=3
OPPORTUNITY_TIMEOUT=30000
QUEUE_POLL_INTERVAL=1000

# Flashbot Configuration
ARBITRAGE_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
FLASHBOTS_RELAY=https://relay.flashbots.net
FLASHBOT_TARGET_BLOCK_OFFSET=1
FLASHBOT_MAX_BUNDLE_SIZE=3
FLASHBOT_BUNDLE_TIMEOUT=30000
FLASHBOT_MIN_PROFIT_THRESHOLD=0.01
FLASHBOT_DEADLINE_BUFFER=300

# Gas Configuration
GAS_STRATEGY=dynamic
MAX_FEE_PER_GAS=100
MAX_PRIORITY_FEE_PER_GAS=5
GAS_LIMIT=500000
GAS_BUFFER=1.2
MAX_GAS_PRICE=100
GAS_PRICE_MULTIPLIER=1.1
GAS_HISTORY_HOURS=24

# Monitoring Configuration
ENABLE_MONITORING=true
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
METRICS_INTERVAL=60000
ALERT_ERROR_RATE_THRESHOLD=0.1
ALERT_RESPONSE_TIME_THRESHOLD=5000
ALERT_PROFIT_DROP_THRESHOLD=0.5

# Security Configuration
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true
ENABLE_HELMET=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Performance Configuration
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
ENABLE_GZIP=true
MAX_PAYLOAD_SIZE=10mb

# Error Handling Configuration
ENABLE_GLOBAL_ERROR_HANDLER=true
ENABLE_UNHANDLED_REJECTION_HANDLER=true
ENABLE_GRACEFUL_SHUTDOWN=true
SHUTDOWN_TIMEOUT=30000
ENABLE_CIRCUIT_BREAKER=true

# API Configuration
PORT=3000
HOST=0.0.0.0
API_VERSION=v1
API_PREFIX=/api
ENABLE_API_DOCS=true

# Database Maintenance
ENABLE_DB_CLEANUP=true
DB_CLEANUP_INTERVAL=86400000
DB_RETENTION_ARBITRAGE_SCANS=30d
DB_RETENTION_PRICE_FEEDS=7d
DB_RETENTION_GAS_PRICE_HISTORY=7d
DB_RETENTION_SYSTEM_HEALTH=7d
ENABLE_DB_VACUUM=true
ENABLE_DB_ANALYZE=true
MV_REFRESH_INTERVAL=3600000

# External Services
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
INFURA_PROJECT_ID=YOUR_INFURA_PROJECT_ID
INFURA_PROJECT_SECRET=YOUR_INFURA_PROJECT_SECRET
ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY

# IMPORTANT: Set your private key securely
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
EOF
    
    print_warning "Please edit $APP_DIR/.env with your actual configuration values"
    print_warning "Especially: DATABASE_URL, PRIVATE_KEY, and RPC endpoints"
    
    print_success "Environment configuration created"
}

# Function to setup PM2
setup_pm2() {
    print_status "Setting up PM2 process manager..."
    
    # Create PM2 ecosystem file
    sudo -u $APP_USER tee $APP_DIR/ecosystem.config.js > /dev/null <<EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: 'src/main.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$LOG_DIR/err.log',
    out_file: '$LOG_DIR/out.log',
    log_file: '$LOG_DIR/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 5000
  }]
};
EOF
    
    # Install PM2 globally for the user
    sudo -u $APP_USER npm install -g pm2
    
    print_success "PM2 configuration created"
}

# Function to setup systemd service
setup_systemd() {
    print_status "Setting up systemd service..."
    
    # Create systemd service file
    sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Arbitrage Trading Bot
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=forking
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
ExecRestart=/usr/bin/pm2 restart ecosystem.config.js --env production
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable $SERVICE_NAME
    
    print_success "Systemd service configured and enabled"
}

# Function to setup Nginx
setup_nginx() {
    print_status "Setting up Nginx reverse proxy..."
    
    # Create Nginx configuration
    sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Rate Limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=1r/s;
    
    # Client Configuration
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;
    
    # Proxy Configuration
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    
    # API Routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Frontend Routes
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health Check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Logging
    access_log /var/log/nginx/arbitrage-bot.access.log;
    error_log /var/log/nginx/arbitrage-bot.error.log;
}
EOF
    
    # Enable site
    sudo ln -sf $NGINX_CONF $NGINX_ENABLED
    
    # Test Nginx configuration
    sudo nginx -t
    
    print_success "Nginx configuration created and tested"
}

# Function to setup SSL
setup_ssl() {
    print_status "Setting up SSL certificate..."
    
    print_warning "Please ensure your domain is pointing to this server before continuing"
    read -p "Press Enter to continue with SSL setup..."
    
    # Get domain name from user
    read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
    
    if [ -n "$DOMAIN_NAME" ]; then
        # Update Nginx config with actual domain
        sudo sed -i "s/yourdomain.com/$DOMAIN_NAME/g" $NGINX_CONF
        sudo sed -i "s/www.yourdomain.com/www.$DOMAIN_NAME/g" $NGINX_CONF
        
        # Update SSL directory path
        SSL_DIR="/etc/letsencrypt/live/$DOMAIN_NAME"
        sudo sed -i "s|/etc/letsencrypt/live/yourdomain.com|$SSL_DIR|g" $NGINX_CONF
        
        # Obtain SSL certificate
        sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME
        
        # Setup auto-renewal
        sudo crontab -l 2>/dev/null | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -
        
        print_success "SSL certificate obtained and auto-renewal configured"
    else
        print_warning "SSL setup skipped. Please configure manually later."
    fi
}

# Function to setup log rotation
setup_log_rotation() {
    print_status "Setting up log rotation..."
    
    # Create logrotate configuration
    sudo tee /etc/logrotate.d/$SERVICE_NAME > /dev/null <<EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 $APP_USER $APP_GROUP
    postrotate
        systemctl reload $SERVICE_NAME > /dev/null 2>&1 || true
    endscript
}
EOF
    
    print_success "Log rotation configured"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create monitoring script
    sudo -u $APP_USER tee $APP_DIR/monitor.sh > /dev/null <<'EOF'
#!/bin/bash

# Monitoring script for arbitrage bot
LOG_FILE="/var/log/arbitrage-bot/monitor.log"
APP_DIR="/opt/arbitrage-bot"

# Log function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# Check if bot is running
if ! pm2 list | grep -q "arbitrage-bot"; then
    log "ERROR: Bot is not running, attempting restart"
    cd $APP_DIR
    pm2 start ecosystem.config.js --env production
    log "Bot restart attempted"
fi

# Check memory usage
MEMORY_USAGE=$(pm2 list | grep "arbitrage-bot" | awk '{print $7}' | sed 's/%//')
if [ "$MEMORY_USAGE" -gt 80 ]; then
    log "WARNING: High memory usage: ${MEMORY_USAGE}%"
fi

# Check CPU usage
CPU_USAGE=$(pm2 list | grep "arbitrage-bot" | awk '{print $6}' | sed 's/%//')
if [ "$CPU_USAGE" -gt 80 ]; then
    log "WARNING: High CPU usage: ${CPU_USAGE}%"
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: High disk usage: ${DISK_USAGE}%"
fi

log "Monitoring check completed"
EOF
    
    # Make script executable
    sudo chmod +x $APP_DIR/monitor.sh
    
    # Add to crontab
    sudo crontab -l 2>/dev/null | { cat; echo "*/5 * * * * $APP_DIR/monitor.sh"; } | sudo crontab -
    
    print_success "Monitoring script created and scheduled"
}

# Function to setup firewall
setup_firewall() {
    print_status "Setting up firewall..."
    
    # Install UFW if not present
    if ! command_exists ufw; then
        sudo apt-get install -y ufw
    fi
    
    # Configure firewall
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow application port (if not using Nginx)
    sudo ufw allow 3000/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    print_success "Firewall configured and enabled"
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    # Create database and user
    sudo -u postgres psql <<EOF
CREATE DATABASE arbitrage_bot;
CREATE USER arbitrage_user WITH ENCRYPTED PASSWORD 'arbitrage_password_123';
GRANT ALL PRIVILEGES ON DATABASE arbitrage_bot TO arbitrage_user;
ALTER USER arbitrage_user CREATEDB;
\q
EOF
    
    print_warning "Database created with default credentials. Please change them in production!"
    print_warning "Database: arbitrage_bot, User: arbitrage_user, Password: arbitrage_password_123"
    
    print_success "Database setup completed"
}

# Function to final setup
final_setup() {
    print_status "Performing final setup..."
    
    # Set proper permissions
    sudo chown -R $APP_USER:$APP_GROUP $APP_DIR
    sudo chmod -R 755 $APP_DIR
    
    # Initialize database
    cd $APP_DIR
    sudo -u $APP_USER npm run init-db
    
    # Start services
    sudo systemctl start nginx
    sudo systemctl start $SERVICE_NAME
    
    # Check service status
    sudo systemctl status $SERVICE_NAME --no-pager
    sudo systemctl status nginx --no-pager
    
    print_success "Final setup completed"
}

# Function to display deployment summary
deployment_summary() {
    print_success "🎉 Production deployment completed successfully!"
    echo
    echo "📋 Deployment Summary:"
    echo "======================"
    echo "Application Directory: $APP_DIR"
    echo "Log Directory: $LOG_DIR"
    echo "Service Name: $SERVICE_NAME"
    echo "User: $APP_USER"
    echo "Group: $APP_GROUP"
    echo
    echo "🔧 Next Steps:"
    echo "1. Edit $APP_DIR/.env with your actual configuration"
    echo "2. Update Nginx configuration with your domain"
    echo "3. Test the application: http://localhost:3000"
    echo "4. Check logs: tail -f $LOG_DIR/out.log"
    echo "5. Monitor with: pm2 monit"
    echo
    echo "📊 Useful Commands:"
    echo "Start bot: sudo systemctl start $SERVICE_NAME"
    echo "Stop bot: sudo systemctl stop $SERVICE_NAME"
    echo "Restart bot: sudo systemctl restart $SERVICE_NAME"
    echo "Check status: sudo systemctl status $SERVICE_NAME"
    echo "View logs: sudo journalctl -u $SERVICE_NAME -f"
    echo
    echo "🔒 Security Notes:"
    echo "- Change default database passwords"
    echo "- Update .env file with secure values"
    echo "- Configure firewall rules as needed"
    echo "- Set up monitoring and alerting"
    echo
    echo "📚 Documentation:"
    echo "Check README.md for detailed usage instructions"
}

# Main deployment function
main() {
    echo "🚀 Starting Production Deployment for Arbitrage Trading Bot"
    echo "=========================================================="
    echo
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Please do not run this script as root. Use a regular user with sudo privileges."
        exit 1
    fi
    
    # Check requirements
    check_requirements
    
    # Setup system
    setup_user
    setup_directories
    install_application
    setup_environment
    setup_pm2
    setup_systemd
    setup_nginx
    setup_ssl
    setup_log_rotation
    setup_monitoring
    setup_firewall
    setup_database
    final_setup
    
    # Display summary
    deployment_summary
}

# Run main function
main "$@"
