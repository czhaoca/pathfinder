#!/bin/bash

# Setup script for Mermaid CLI with architecture detection
# This script ensures Chrome/Chromium is properly installed for Puppeteer

echo "Setting up Mermaid CLI environment..."

# Detect system architecture
ARCH=$(uname -m)
OS=$(uname -s)

echo "Detected architecture: $ARCH"
echo "Detected OS: $OS"

# Function to check if Chrome is available for Puppeteer
check_chrome() {
    if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        # For ARM, check for regular Chrome
        if [ -d "$HOME/.cache/puppeteer/chrome" ]; then
            echo "Chrome for ARM found in Puppeteer cache"
            return 0
        else
            echo "Chrome for ARM not found in Puppeteer cache"
            return 1
        fi
    else
        # For x86/x64, check for chrome-headless-shell
        if [ -d "$HOME/.cache/puppeteer/chrome-headless-shell" ]; then
            echo "Chrome headless shell found in Puppeteer cache"
            return 0
        else
            echo "Chrome headless shell not found in Puppeteer cache"
            return 1
        fi
    fi
}

# Function to install Chrome for Puppeteer
install_chrome() {
    echo "Installing Chrome for Puppeteer..."
    
    if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        echo "ARM architecture detected. Installing Chrome for ARM..."
        # For ARM, we need to use chrome instead of chrome-headless-shell
        PUPPETEER_PRODUCT=chrome npx puppeteer browsers install chrome
    else
        echo "x86/x64 architecture detected. Installing Chrome headless shell..."
        npx puppeteer browsers install chrome-headless-shell
    fi
    
    if [ $? -eq 0 ]; then
        echo "Chrome installation completed successfully"
        return 0
    else
        echo "Chrome installation failed"
        return 1
    fi
}

# Main setup logic
if ! check_chrome; then
    echo "Chrome not found for Puppeteer. Installing..."
    install_chrome
else
    echo "Chrome already installed for Puppeteer"
fi

# Create a wrapper script that sets the correct environment
cat > /home/czgit/pathfinder/scripts/mermaid-wrapper.sh << 'EOF'
#!/bin/bash

# Wrapper script for mmdc that handles ARM compatibility

ARCH=$(uname -m)

if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    # For ARM, use chrome product instead of chrome-headless-shell
    export PUPPETEER_PRODUCT=chrome
fi

# Run mmdc with all passed arguments
mmdc "$@"
EOF

chmod +x /home/czgit/pathfinder/scripts/mermaid-wrapper.sh

echo "Setup complete!"
echo ""
echo "You can now use:"
echo "  ./scripts/mermaid-wrapper.sh -i input.mmd -o output.png"
echo "  or"
echo "  ./scripts/mermaid-to-png.sh input.mmd [output.png]"