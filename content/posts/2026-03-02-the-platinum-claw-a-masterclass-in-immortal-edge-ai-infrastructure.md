---
draft: false
title: 'The Platinum Claw: A Masterclass in Immortal Edge AI Infrastructure'
summary: How to build a self-healing, hardware-aware AI cluster that survives the chaos of the edge using the Platinum Claw protocol.
date: 2026-03-02T22:44:00
cover: /img/Gemini_Generated_Image_hy6zyvhy6zyvhy6z.png
categories:
  - Edge Computing
  - Cybersecurity
  - Artificial Intelligence
tags:
  - Kubernetes
  - Edge-AI
  - DevOps
  - Cybersecurity
  - Linux-Kernel
---

# The Platinum Claw: Edge AI & Autonomous Infrastructure

## 🧩 Part 1: The Anatomy of the Platinum Claw

Before we reveal the scripts, we must understand the "Genetic Code" that makes this infrastructure different from a standard installation. We don't just install software; we modify the physical behavior of the hardware.

### 1. The Atomic Boot Loader

We don't trust factory settings. We proactively patch the bootloader to prevent hardware "latency naps." By disabling ASPM (Active State Power Management), we keep the PCIe lanes at high voltage, ensuring the Hailo-8 NPU never enters a sleep state that would lag AI inference.

### 2. The Storage Migration Engine (New)

Standard mounts fail silently, and Raspberry Pis are notorious for killing SD cards through write-exhaustion. **Phase 7** of the Platinum OS physically migrates the core databases of K3s and Docker off your boot drive and symlinks them to a high-speed NVMe/SSD. We follow this up with a kernel-level lock (`chattr +i`) to make the base directory unwritable. If the NVMe drops offline, the system refuses to write, saving your hardware.

### 3. The Cryptographic Pacemaker

Kubernetes certificates expire in 365 days. If your cluster is so stable it never reboots, it will "die" on its first birthday. We built a heartbeat for the CA—a monthly cron job that silently renews communication TLS keys without downtime.

### 4. The Autonomous Auto-Heal Engine

At the edge, network blips create "Ghost Pods" (Unknown/Evicted states) that hold your distributed storage volumes hostage. **Phase 5** introduces an Auto-Heal Engine that scans the cluster for these zombies and executes a surgical purge, immediately releasing the storage locks so new AI pods can boot.

### 5. The Autonomous Injection Engine (The Omega Protocol)

You cannot manually `apt-get install` tools into running containers every time an AI agent needs a new capability. We implement a self-validating CI/CD loop that dynamically injects system dependencies (like `ffmpeg`, `sqlite3`, `pandoc`) directly into the agent's container image via a nightly cron job, gracefully handling upstream developer build failures without taking the agent offline.

***

## 🏗️ Step-by-Step Installation Instructions

### Step 1: The Master Brain (Lenovo m700q or x86 PC)

1. **Hardening:** Run **Phase 1**. Give the node a unique hostname (e.g., `claw-master`). **Reboot immediately** to lock the GRUB PCIe settings.
2. **Bootstrap:** Run **Phase 2**. Enter your LAN IP.
3. **Capture:** Securely save the `Join Token` and the `ArgoCD Password` generated at the end.

### Step 2: The Storage Migration

1. Ensure your external NVMe or SSD is mounted (e.g., `/mnt/nvme3`).
2. Run **Phase 7**. This will temporarily stop Kubernetes, migrate the `/var/lib/docker` and `/var/lib/rancher` directories to your SSD, and restart the engines. Your cluster now runs at PCIe speeds.

### Step 3: The Acceleration Muscle (Raspberry Pi 5)

1. **Hardening:** Run **Phase 1** on the Pi. Use a unique name (e.g., `claw-worker-01`). **Select YES for Hailo-8 drivers.**
2. **Reboot:** The NPU drivers require a fresh kernel load.
3. **Join:** Run **Phase 3**. Paste the `Join Token` from your Master node.

### Step 4: Core Infra & App Deployment

1. On the Master node, run **Phase 4**.
2. **Core AI Infra:** Say "Yes" to deploying `pgvector` and `OpenTelemetry`. This creates your unified vector database.
3. **Select your Stack:** Choose between GoClaw, the Whisper API, or the Immich Photo Stack. The system will auto-compile, inject, and route the application to the correct hardware (e.g., flying the Whisper container directly to the node with the Hailo NPU).

***

## 🦞 The Foundation Script: The Platinum OS

Below is the complete, uncut logic for the base infrastructure. This script handles everything from QEMU cross-compilation and eBPF network routing to SCP bridging for remote node deployments.

_(Note: Ensure you run this as root: `sudo ./platinum_claw.sh`)_

```bash
#!/bin/bash

# ==============================================================================
#  🦞 OPENCLAW PLATINUM OS: THE OMEGA SINGULARITY
#  Fully Autonomous CI/CD | Storage Engine Migration | Auto-Heal Diagnostics
# ==============================================================================

set -o pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

SET_BOLD='\033[1m'; SET_GREEN='\033[1;32m'; SET_CYAN='\033[1;36m'; SET_YELLOW='\033[1;33m'; SET_RED='\033[1;31m'; SET_RESET='\033[0m'
log() { echo -e "${SET_BOLD}${SET_GREEN}[+] $1${SET_RESET}"; }
warn() { echo -e "${SET_BOLD}${SET_YELLOW}[!] $1${SET_RESET}"; }
info() { echo -e "${SET_BOLD}${SET_CYAN}[i] $1${SET_RESET}"; }
err() { echo -e "${SET_BOLD}${SET_RED}[ERROR] $1${SET_RESET}"; exit 1; }

if [ "$EUID" -ne 0 ]; then err "Run as root: sudo ./platinum_claw.sh"; fi

# --- IMMUTABLE VERSION LOCKS ---
K3S_VERSION="v1.30.4+k3s1"
CILIUM_VERSION="1.15.1"
LONGHORN_VERSION="1.7.1"
ARGOCD_VERSION="v2.12.3"
CLOUDFLARED_VERSION="2026.1.2"

IS_RPI=$(grep -i "raspberry" /sys/firmware/devicetree/base/model 2>/dev/null)
SYS_ARCH=$(uname -m)
ACTUAL_USER=$(logname 2>/dev/null || echo ${SUDO_USER:-$(whoami)})
CURRENT_HOSTNAME=$(hostname)

# --- SECURE VAULT ---
SECURE_VAULT=$(mktemp -d)
chmod 700 "$SECURE_VAULT"
cleanup() { [ -d "$SECURE_VAULT" ] && rm -rf "$SECURE_VAULT"; }
trap cleanup EXIT
gen_pass() { tr -dc A-Za-z0-9 </dev/urandom | head -c 24; }

wait_for_pkg_mgr() {
    while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || pidof dnf >/dev/null 2>&1; do
        warn "Package manager locked. Waiting..."; sleep 5
    done
}

enforce_time() {
    if [ "$(date +%Y)" -lt 2024 ]; then
        warn "RTC desynced. Forcing NTP sync..."
        systemctl restart systemd-timesyncd 2>/dev/null || true; ntpd -gq 2>/dev/null || true
        while [ "$(date +%Y)" -lt 2024 ]; do sleep 2; done; log "Time secured."
    fi
}

resolve_dns() {
    SAFE_RESOLV="/etc/resolv.conf"
    grep -q "127.0.0.53" /etc/resolv.conf 2>/dev/null && [ -f /run/systemd/resolve/resolv.conf ] && SAFE_RESOLV="/run/systemd/resolve/resolv.conf"
    echo "$SAFE_RESOLV"
}

helm_retry() {
    local cmd="$1"; local count=0
    until $cmd || [ $count -eq 3 ]; do count=$((count+1)); warn "Helm failed. Retry $count/3..."; sleep 5; done
    [ $count -eq 3 ] && err "Helm failed permanently."
}

if command -v apt-get >/dev/null 2>&1; then PKG_MGR="apt-get install -yqq"; PKG_UPD="apt-get update -qq"; OS_TYPE="debian"
elif command -v dnf >/dev/null 2>&1; then PKG_MGR="dnf install -yq"; PKG_UPD="dnf check-update -q"; OS_TYPE="rhel"
else err "Unsupported OS."; fi

BOOT_DIR="/boot"; [ -d "/boot/firmware" ] && BOOT_DIR="/boot/firmware"

# --- TITANIUM PARAMETERS ---
KUBELET_RES="--kubelet-arg=system-reserved=cpu=250m,memory=512Mi --kubelet-arg=kube-reserved=cpu=250m,memory=512Mi"
GC_ARGS="--kubelet-arg=image-gc-high-threshold=75 --kubelet-arg=image-gc-low-threshold=60 --kubelet-arg=container-log-max-size=50Mi --kubelet-arg=container-log-max-files=3"
API_EVICTION="--kube-apiserver-arg=default-not-ready-toleration-seconds=60 --kube-apiserver-arg=default-unreachable-toleration-seconds=60"

while true; do
    echo -e "\n${SET_BOLD}${SET_CYAN}"
    echo "  ____  _       _   _                             "_
_    echo " |  _ \| | __ _| |_(_)_ __  _   _ _ __ ___        "
    echo " | |_) | |/ _\` | __| | '_ \| | | | '_ \` _ \       "
    echo " |  __/| | (_| | |_| | | | | |_| | | | | | |      "
    echo " |_|   |_|__,_|__|_|_| |_|__,_|_| |_| |_| "
    echo "     THE OMEGA SINGULARITY | AUTONOMOUS CLUSTER   "
    echo -e "${SET_RESET}"

    echo "0) 📦 Phase 0: Generic Build Factory (Non-GoClaw/Whisper)"
    echo "1) 🛠️  Phase 1: Bare Metal Titanium Hardening"
    echo "2) 🧠 Phase 2: Bootstrap Master Node"
    echo "3) 🚀 Phase 3: Join Worker Node"
    echo "4) 🦞 Phase 4: Omni-Agent App Store Injector"
    echo "5) 📊 Phase 5: Cluster Health & Auto-Heal Engine"
    echo "6) 🗑️  Phase 6: Purge Running Agent/Infra"
    echo "7) 💾 Phase 7: Storage Engine Migration (NVMe/SSD)"
    echo "8) ❌ Exit"
    read -p "Select [0-8]: " MENU_OPT

    case $MENU_OPT in
        0)
            log "Initiating Build Factory..."
            if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; fi
            wait_for_pkg_mgr; $PKG_UPD >/dev/null 2>&1; $PKG_MGR docker-buildx-plugin qemu-user-static git >/dev/null 2>&1

            SOURCE_DIR=""; while [[ ! -d "$SOURCE_DIR" ]]; do read -p "Source path (e.g., .): " SOURCE_DIR; done
            TARGET_IMAGE=""; while [[ -z "$TARGET_IMAGE" ]]; do read -p "Target (e.g. user/app:latest): " TARGET_IMAGE; done

            docker run --privileged --rm tonistiigi/binfmt --install all >/dev/null 2>&1
            docker buildx create --name builder --use 2>/dev/null || docker buildx use builder
            REG_URL=$(echo "$TARGET_IMAGE" | cut -d/ -f1); [[ "$REG_URL" == *"."* ]] && docker login "$REG_URL" || docker login
            cd "$SOURCE_DIR" && docker buildx build --platform linux/amd64,linux/arm64 -t "$TARGET_IMAGE" --push .
            log "🎉 Image pushed to registry!"
            ;;

        1)
            log "Hardening Bare Metal..."
            if [ "$SYS_ARCH" != "x86_64" ] && [ "$SYS_ARCH" != "aarch64" ]; then err "MUST be 64-bit OS!"; fi

            H=$(hostname); if [[ "$H" =~ ^(raspberrypi|ubuntu|debian|dietpi|localhost)$ ]]; then
                read -p "Enter UNIQUE hostname: " NH
                hostnamectl set-hostname "$NH"
                sed -i "/^127.0.1.1/d" /etc/hosts
                echo -e "127.0.1.1\t$NH" >> /etc/hosts
            fi

            if systemctl is-active --quiet systemd-oomd; then systemctl disable --now systemd-oomd; systemctl mask systemd-oomd; fi
            [ -x "$(command -v ufw)" ] && ufw disable; [ -x "$(command -v firewalld)" ] && systemctl disable --now firewalld

            sed -i 's/^#RateLimit/RateLimit/g; s/RateLimitIntervalSec=.*/RateLimitIntervalSec=0/; s/RateLimitBurst=.*/RateLimitBurst=0/' /etc/systemd/journald.conf
            sed -i 's/^#Storage=.*/Storage=volatile/' /etc/systemd/journald.conf
            sed -i 's/^#SystemMaxUse=.*/SystemMaxUse=50M/' /etc/systemd/journald.conf
            systemctl restart systemd-journald

            swapoff -a; sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
            [ -x "$(command -v dphys-swapfile)" ] && { dphys-swapfile swapoff; dphys-swapfile uninstall; systemctl disable --now dphys-swapfile; }

            grep -q "bpffs" /etc/fstab || { echo "bpffs /sys/fs/bpf bpf defaults 0 0" >> /etc/fstab; mount /sys/fs/bpf; }

            if [ ! -z "$IS_RPI" ]; then
                rpi-eeprom-update -a >/dev/null 2>&1 || true
                sed -i '1 s/$/ cgroup_memory=1 cgroup_enable=memory pcie_aspm=off/' $BOOT_DIR/cmdline.txt
                grep -q "dtparam=pciex1" $BOOT_DIR/config.txt || echo -e "\ndtparam=pciex1\ndtparam=pciex1-gen3" >> $BOOT_DIR/config.txt
            elif [[ "$SYS_ARCH" == "x86_64" ]] && [ -f /etc/default/grub ]; then
                sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="pcie_aspm=off /' /etc/default/grub; update-grub
            fi

            info "Native Dependencies..."
            wait_for_pkg_mgr; $PKG_UPD >/dev/null 2>&1
            $PKG_MGR linux-headers-$(uname -r) build-essential dkms open-iscsi nfs-common multipath-tools xfsprogs curl jq git >/dev/null 2>&1
            systemctl enable --now iscsid; modprobe iscsi_tcp; grep -q "iscsi_tcp" /etc/modules || echo "iscsi_tcp" >> /etc/modules
            [ ! -f /etc/iscsi/initiatorname.iscsi ] && { echo "InitiatorName=$(iscsi-iname)" > /etc/iscsi/initiatorname.iscsi; systemctl restart iscsid; }

            cat << 'EOF' > /etc/sysctl.d/99-k8s-hardened.conf
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
fs.inotify.max_user_instances=524288
fs.inotify.max_user_watches=1048576
kernel.pid_max=4194304
net.ipv4.neigh.default.gc_thresh1=1024
net.ipv4.neigh.default.gc_thresh2=2048
net.ipv4.neigh.default.gc_thresh3=4096
EOF
            sysctl -p /etc/sysctl.d/99-k8s-hardened.conf >/dev/null 2>&1
            echo -e "blacklist {\n  devnode \"^sd[a-z0-9]+\"\n  devnode \"^nvme[0-9]n[0-9]+\"\n  devnode \"^loop[0-9]+\"\n}" > /etc/multipath.conf; systemctl restart multipathd

            read -p "Mount NVMe at /mnt/nvme3 for Longhorn? [y/N]: " HN
            if [[ "$HN" =~ ^[Yy]$ ]]; then
                mkdir -p /mnt/nvme3/longhorn /var/lib/longhorn; chattr -i /var/lib/longhorn 2>/dev/null || true
                if ! mountpoint -q /var/lib/longhorn; then
                    chattr +i /var/lib/longhorn
                    grep -q "/mnt/nvme3/longhorn" /etc/fstab || echo "/mnt/nvme3/longhorn /var/lib/longhorn none bind,x-systemd.requires-mounts-for=/mnt/nvme3,nofail 0 0" >> /etc/fstab
                    mount -a
                fi
            fi

            read -p "Install Hailo AI drivers? [y/N]: " HH; if [[ "$HH" =~ ^[Yy]$ ]]; then
                $PKG_MGR hailo-all >/dev/null 2>&1; echo 'SUBSYSTEM=="misc", KERNEL=="hailo*", MODE="0666"' > /etc/udev/rules.d/99-hailo.rules
                echo 'options hailo_pci force_desc_page_size=4096' > /etc/modprobe.d/hailo_pci.conf
                modprobe hailo_pci; udevadm control --reload-rules && udevadm trigger; touch /etc/platinum_hailo_node; fi

            [ -x "$(command -v tailscale)" ] || { curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 && tailscale up --ssh; }
            log "PHASE 1 READY. Rebooting in 5s..."; sleep 5; reboot ;;

        2)
            enforce_time; SDNS=$(resolve_dns); TARG=""; MTU="1500"
            if command -v tailscale >/dev/null 2>&1; then TIP=$(tailscale ip -4); [ -n "$TIP" ] && { TARG="--tls-san $TIP"; MTU="1280"; }; fi
            LIP=""; while [[ -z "$LIP" ]]; do read -p "Master LAN IP: " LIP; done
            LABELS="--node-label node.longhorn.io/create-default-disk=true"; [ -f /etc/platinum_hailo_node ] && LABELS="$LABELS --node-label hardware.hailo=true"

            iptables -F; iptables -X; iptables -t nat -F; iptables -t nat -X
            curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" INSTALL_K3S_EXEC="--node-ip $LIP --flannel-backend=none --disable-network-policy --disable-kube-proxy --disable traefik --disable servicelb --disable local-storage $GC_ARGS $API_EVICTION $KUBELET_RES $TARG --resolv-conf=$SDNS $LABELS" sh -s -

            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); mkdir -p $UH/.kube; cp /etc/rancher/k3s/k3s.yaml $UH/.kube/config; chown -R $ACTUAL_USER:$ACTUAL_USER $UH/.kube; chmod 600 $UH/.kube/config; export KUBECONFIG=$UH/.kube/config; fi

            DEPS="iscsid.service multipathd.service"; [ -x "$(command -v tailscale)" ] && DEPS="tailscaled.service $DEPS"
            mkdir -p /etc/systemd/system/k3s.service.d; echo -e "[Unit]\nAfter=$DEPS\nWants=$DEPS\n[Service]\nLimitNOFILE=1048576\nLimitNPROC=infinity" > /etc/systemd/system/k3s.service.d/override.conf; systemctl daemon-reload && systemctl restart k3s

            echo -e "#!/bin/bash\nsystemctl restart k3s" > /etc/cron.monthly/k3s-certs; chmod +x /etc/cron.monthly/k3s-certs

            until kubectl get nodes >/dev/null 2>&1; do sleep 3; done
            HB="/usr/local/bin/helm"; [ -x "$HB" ] || { curl -sL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash; }

            helm_retry "$HB repo add cilium https://helm.cilium.io/"
            helm_retry "$HB upgrade --install cilium cilium/cilium --namespace kube-system --set kubeProxyReplacement=true --set k8sServiceHost=$LIP --set k8sServicePort=6443 --set mtu=$MTU --set bpf.masquerade=true --set hostServices.enabled=true"
            helm_retry "$HB repo add longhorn https://charts.longhorn.io/"
            helm_retry "$HB upgrade --install longhorn longhorn/longhorn --namespace longhorn-system --create-namespace --set defaultSettings.replicaCount=2 --set defaultSettings.nodeDownPodDeletionPolicy=do-delete --set defaultSettings.concurrentReplicaRebuildPerNodeLimit=1 --set defaultSettings.defaultDataPath=/var/lib/longhorn"

            kubectl create namespace argocd 2>/dev/null; kubectl apply -n argocd --server-side -f "https://raw.githubusercontent.com/argoproj/argo-cd/$ARGOCD_VERSION/manifests/install.yaml"
            until [ -s /var/lib/rancher/k3s/server/node-token ]; do sleep 2; done; NT=$(cat /var/lib/rancher/k3s/server/node-token)
            until kubectl -n argocd get secret argocd-initial-admin-secret >/dev/null 2>&1; do sleep 5; done; AP=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

            echo -e "--------------------------------------------------------\n🎉 MASTER READY!\nToken: $NT\nArgo UI: admin / $AP\n--------------------------------------------------------" ;;

        3)
            enforce_time; SDNS=$(resolve_dns)
            WIP=""; while [[ -z "$WIP" ]]; do read -p "Worker IP: " WIP; done
            MIP=""; while [[ -z "$MIP" ]]; do read -p "Master IP: " MIP; done
            read -p "Join Token: " NT; read -p "Robust NVMe? [y/N]: " HR
            LABELS=""; [[ "$HR" =~ ^[Yy]$ ]] && LABELS="--node-label node.longhorn.io/create-default-disk=true"
            [ -f /etc/platinum_hailo_node ] && LABELS="$LABELS --node-label hardware.hailo=true"

            curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" K3S_URL=https://$MIP:6443 K3S_TOKEN=$NT INSTALL_K3S_EXEC="--node-ip $WIP $KUBELET_RES $GC_ARGS --resolv-conf=$SDNS $LABELS" sh -s -

            DEPS="iscsid.service multipathd.service"; [ -x "$(command -v tailscale)" ] && DEPS="tailscaled.service $DEPS"
            mkdir -p /etc/systemd/system/k3s-agent.service.d; echo -e "[Unit]\nAfter=$DEPS\nWants=$DEPS\n[Service]\nLimitNOFILE=1048576" > /etc/systemd/system/k3s-agent.service.d/override.conf; systemctl daemon-reload && systemctl restart k3s-agent
            echo -e "#!/bin/bash\nsystemctl restart k3s-agent" > /etc/cron.monthly/k3s-certs; chmod +x /etc/cron.monthly/k3s-certs
            log "Worker Joined!" ;;

        4)
            log "🦞 Phase 4: Omni-Agent App Store Injector"
            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); [ -f "$UH/.kube/config" ] && export KUBECONFIG="$UH/.kube/config"; fi

            read -p "Deploy Core AI Infra (pgvector + OpenTelemetry)? [y/N]: " CORE_INFRA
            if [[ "$CORE_INFRA" =~ ^[Yy]$ ]]; then
                log "Injecting Core Infrastructure..."
                DB_PASS=$(gen_pass)
                kubectl create secret generic pgvector-creds --from-literal=password="$DB_PASS" 2>/dev/null
                kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: pgvector-pvc, namespace: default }
spec: { accessModes: [ "ReadWriteOnce" ], storageClassName: longhorn, resources: { requests: { storage: 10Gi } } }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: pgvector, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: pgvector } }
  template:
    metadata: { labels: { app: pgvector } }
    spec:
      securityContext: { fsGroup: 999 }
      containers:
      - name: pgvector
        image: ankane/pgvector:latest
        env:
        - name: POSTGRES_PASSWORD
          valueFrom: { secretKeyRef: { name: pgvector-creds, key: password } }
        - { name: POSTGRES_DB, value: "agents" }
        - { name: PGDATA, value: "/var/lib/postgresql/data/pgdata" }
        ports: [ { containerPort: 5432 } ]
        volumeMounts: [ { name: pgdata, mountPath: /var/lib/postgresql/data } ]
      volumes: [ { name: pgdata, persistentVolumeClaim: { claimName: pgvector-pvc } } ]
---
apiVersion: v1
kind: Service
metadata: { name: pgvector-svc, namespace: default }
spec: { selector: { app: pgvector }, ports: [ { port: 5432, targetPort: 5432 } ] }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: otel-collector, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: otel-collector } }
  template:
    metadata: { labels: { app: otel-collector } }
    spec:
      containers:
      - name: otel
        image: otel/opentelemetry-collector:latest
        ports: [ { containerPort: 4317 }, { containerPort: 4318 } ]
---
apiVersion: v1
kind: Service
metadata: { name: otel-collector-svc, namespace: default }
spec: { selector: { app: otel-collector }, ports: [ { port: 4317, targetPort: 4317, name: grpc }, { port: 4318, targetPort: 4318, name: http } ] }
EOF
                log "Core Infra deployed."
            fi

            echo -e "\n1) GoClaw Stack (Backend + UI) | 2) Whisper API | 3) Immich Photo Stack"
            read -p "App/Agent [1-3]: " AO

            # --- IMMICH DEDICATED ROUTINE ---
            if [ "$AO" == "3" ]; then
                log "Initializing Enterprise Immich Stack..."
                IMMICH_DB_PASS=$(gen_pass)
                kubectl create secret generic immich-creds --from-literal=db-password="$IMMICH_DB_PASS" 2>/dev/null

                NODE_SEL_YAML=""
                read -p "Pin Immich compute to a specific node? (e.g., claw-master) [Leave blank for any]: " TARGET_NODE
                if [ -n "$TARGET_NODE" ]; then NODE_SEL_YAML=$(cat <<EOF
      nodeSelector:
        kubernetes.io/hostname: "$TARGET_NODE"
EOF
); fi

                read -p "Use NFS for UPLOAD_LOCATION (Photos/Videos)? [y/N]: " USE_NFS
                VOL_UPLOAD_YAML=""
                if [[ "$USE_NFS" =~ ^[Yy]$ ]]; then
                    read -p "NFS Server IP: " NFS_IP
                    read -p "NFS Shared Path [Default: /mnt/raid/library]: " UPLOAD_LOC
                    [ -z "$UPLOAD_LOC" ] && UPLOAD_LOC="/mnt/raid/library"
                    VOL_UPLOAD_YAML=$(cat <<EOF
      - name: upload
        nfs:
          server: "$NFS_IP"
          path: "$UPLOAD_LOC"
EOF
)
                else
                    read -p "Local HostPath for Photos [Default: /mnt/raid/library]: " UPLOAD_LOC
                    [ -z "$UPLOAD_LOC" ] && UPLOAD_LOC="/mnt/raid/library"
                    mkdir -p "$UPLOAD_LOC" 2>/dev/null || true
                    VOL_UPLOAD_YAML=$(cat <<EOF
      - name: upload
        hostPath: { path: "$UPLOAD_LOC", type: DirectoryOrCreate }
EOF
)
                fi

                read -s -p "CF Token for Immich Server (Leave blank for internal only): " CFT; echo ""
                TUNNEL_YAML=""
                if [ -n "$CFT" ]; then
                    kubectl create secret generic immich-cf --from-literal=token="$CFT" 2>/dev/null
                    TUNNEL_YAML=$(cat <<EOF
      - name: tunnel
        image: cloudflare/cloudflared:$CLOUDFLARED_VERSION
        command: ["cloudflared", "tunnel", "--no-autoupdate", "run"]
        env:
        - name: TUNNEL_TOKEN
          valueFrom: { secretKeyRef: { name: immich-cf, key: token } }
        resources: { limits: { memory: "256Mi", cpu: "200m" }, requests: { memory: "256Mi", cpu: "200m" } }
EOF
)
                fi

                MAN="$SECURE_VAULT/immich.yaml"
                cat <<EOF > "$MAN"
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: immich-db-pvc, namespace: default }
spec: { accessModes: [ "ReadWriteOnce" ], storageClassName: longhorn, resources: { requests: { storage: 15Gi } } }
---
apiVersion: v1
kind: Service
metadata: { name: immich-db, namespace: default }
spec: { selector: { app: immich-db }, ports: [ { port: 5432 } ] }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: immich-db, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: immich-db } }
  template:
    metadata: { labels: { app: immich-db } }
    spec:
$NODE_SEL_YAML
      securityContext: { fsGroup: 999 }
      containers:
      - name: postgres
        image: tensorchord/pgvecto-rs:pg14-v0.2.0
        env:
        - name: POSTGRES_PASSWORD
          valueFrom: { secretKeyRef: { name: immich-creds, key: db-password } }
        - { name: POSTGRES_USER, value: "postgres" }
        - { name: POSTGRES_DB, value: "immich" }
        - { name: POSTGRES_INITDB_ARGS, value: "--data-checksums" }
        - { name: PGDATA, value: "/var/lib/postgresql/data/pgdata" }
        volumeMounts: [ { name: db-data, mountPath: /var/lib/postgresql/data } ]
      volumes: [ { name: db-data, persistentVolumeClaim: { claimName: immich-db-pvc } } ]
---
apiVersion: v1
kind: Service
metadata: { name: immich-redis, namespace: default }
spec: { selector: { app: immich-redis }, ports: [ { port: 6379 } ] }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: immich-redis, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: immich-redis } }
  template:
    metadata: { labels: { app: immich-redis } }
    spec:
$NODE_SEL_YAML
      containers:
      - name: redis
        image: redis:6.2-alpine
---
apiVersion: v1
kind: Service
metadata: { name: immich-server, namespace: default }
spec: { selector: { app: immich-server }, ports: [ { port: 2283, targetPort: 2283 } ], type: ClusterIP }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: immich-server, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: immich-server } }
  template:
    metadata: { labels: { app: immich-server } }
    spec:
$NODE_SEL_YAML
      containers:
      - name: server
        image: ghcr.io/immich-app/immich-server:release
        env:
        - { name: DB_HOSTNAME, value: "immich-db" }
        - { name: DB_USERNAME, value: "postgres" }
        - name: DB_PASSWORD
          valueFrom: { secretKeyRef: { name: immich-creds, key: db-password } }
        - { name: DB_DATABASE_NAME, value: "immich" }
        - { name: REDIS_HOSTNAME, value: "immich-redis" }
        - { name: TZ, value: "UTC" }
        resources: { limits: { memory: "2Gi", cpu: "1000m" }, requests: { memory: "512Mi", cpu: "250m" } }
        ports: [ { containerPort: 2283 } ]
        volumeMounts: [ { name: upload, mountPath: /usr/src/app/upload } ]
$TUNNEL_YAML
      volumes:
$VOL_UPLOAD_YAML
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: immich-machine-learning, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: immich-machine-learning } }
  template:
    metadata: { labels: { app: immich-machine-learning } }
    spec:
$NODE_SEL_YAML
      containers:
      - name: machine-learning
        image: ghcr.io/immich-app/immich-machine-learning:release
        env:
        - { name: DB_HOSTNAME, value: "immich-db" }
        - { name: DB_USERNAME, value: "postgres" }
        - name: DB_PASSWORD
          valueFrom: { secretKeyRef: { name: immich-creds, key: db-password } }
        - { name: DB_DATABASE_NAME, value: "immich" }
        - { name: TZ, value: "UTC" }
        resources: { limits: { memory: "4Gi", cpu: "2000m" }, requests: { memory: "1Gi", cpu: "500m" } }
        volumeMounts: [ { name: upload, mountPath: /usr/src/app/upload } ]
      volumes:
$VOL_UPLOAD_YAML
EOF
                if kubectl apply -f "$MAN"; then log "Immich Enterprise Stack Deployed!"; else err "Failed to deploy Immich YAML structure."; fi
                continue
            fi

            # --- DYNAMIC DB PASSWORD RESOLUTION ---
            DYNAMIC_DB_PASS=$(kubectl get secret pgvector-creds -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || echo "omega_claw_db_pass")
            DSN_URL="postgres://postgres:${DYNAMIC_DB_PASS}@pgvector-svc:5432/agents?sslmode=disable"

            # --- OMNI-AGENT ROUTINE & DYNAMIC START_CMD ---
            read -p "Target RAM (GB): " TR
            H="false"; PORT="18789"; SHM="1Gi"; IMG=""
            UI_IMG=""
            APP_ENV_YAML=""
            MNT_YAML=""
            VOL_YAML=""
            SAFE_RUN_CMD=""
            UI_CONTAINER_YAML=""
            LOCAL_NODE=""
            SEL_YAML=""
            PULL_POLICY="IfNotPresent"

            case $AO in
                1)
                    AN="goclaw"
                    START_CMD="/app/goclaw"
                    PORT="18790"
                    QMEM="300Mi"
                    QCPU="250m"
                    APP_ENV_YAML="- name: GOMAXPROCS\n          value: \"2\"\n        - name: GOCLAW_MODE\n          value: \"managed\"\n        - name: GOCLAW_AUTO_UPGRADE\n          value: \"true\""
                    SAFE_RUN_CMD="if [ -f /app/data/.env.local ]; then set -a; . /app/data/.env.local; set +a; fi; exec /app/goclaw --config /app/data/config.json"

                    read -p "Path to local GoClaw source folder (Leave blank to use standard registry images): " GOCLAW_DIR
                    if [ -n "$GOCLAW_DIR" ] && [ -d "$GOCLAW_DIR" ]; then
                        read -p "Target Node for deployment (e.g., dietpi): " LOCAL_NODE

                        NODE_STATUS=$(kubectl get node "$LOCAL_NODE" | awk 'NR==2 {print $2}')
                        if [[ -z "$NODE_STATUS" ]] || [[ "$NODE_STATUS" != *"Ready"* ]] || [[ "$NODE_STATUS" == *"NotReady"* ]]; then
                            err "Target node '$LOCAL_NODE' is offline or does not exist. Fix the node first!"
                        fi
                        log "Node '$LOCAL_NODE' is online and ready for injection."

                        log "Syncing Git Repository..."
                        if ! command -v git >/dev/null 2>&1; then wait_for_pkg_mgr; $PKG_MGR git >/dev/null 2>&1; fi
                        (cd "$GOCLAW_DIR" && git pull origin main 2>/dev/null || info "Not a git repository or already up to date.")

                        log "Compiling GoClaw Backend Engine..."
                        (cd "$GOCLAW_DIR" && docker build -t mrnaran/goclaw:latest .) || err "Backend build failed."

                        log "Compiling GoClaw UI Dashboard..."
                        (cd "$GOCLAW_DIR/ui/web" && docker build -t mrnaran/goclaw-ui:latest .) || err "UI build failed."

                        if [ "$CURRENT_HOSTNAME" == "$LOCAL_NODE" ]; then
                            log "Injecting directly into local K3s runtime cache..."
                            docker save mrnaran/goclaw:latest | k3s ctr images import -
                            docker save mrnaran/goclaw-ui:latest | k3s ctr images import -
                        else
                            log "Target is remote. Initiating secure SCP bridge to $LOCAL_NODE..."
                            read -p "SSH Username for $LOCAL_NODE (e.g., dietpi): " REMOTE_USER
                            docker save mrnaran/goclaw:latest > /tmp/goclaw.tar
                            docker save mrnaran/goclaw-ui:latest > /tmp/goclaw-ui.tar
                            scp /tmp/goclaw.tar /tmp/goclaw-ui.tar "$REMOTE_USER@$LOCAL_NODE:/home/$REMOTE_USER/" || err "SCP Transfer failed!"
                            log "Executing remote cache injection..."
                            ssh "$REMOTE_USER@$LOCAL_NODE" "sudo k3s ctr images import /home/$REMOTE_USER/goclaw.tar && sudo k3s ctr images import /home/$REMOTE_USER/goclaw-ui.tar && rm /home/$REMOTE_USER/goclaw.tar /home/$REMOTE_USER/goclaw-ui.tar" || err "Remote import failed!"
                            rm /tmp/goclaw.tar /tmp/goclaw-ui.tar
                        fi

                        log "🎉 Build & Cache Pipeline Complete!"
                        IMG="mrnaran/goclaw:latest"
                        UI_IMG="mrnaran/goclaw-ui:latest"
                        PULL_POLICY="Never"
                    else
                        read -p "Main Image Name/URL [Default: mrnaran/goclaw:latest]: " IMG
                        [ -z "$IMG" ] && IMG="mrnaran/goclaw:latest"
                        read -p "GoClaw UI Image Name/URL [Default: mrnaran/goclaw-ui:latest]: " UI_IMG
                        [ -z "$UI_IMG" ] && UI_IMG="mrnaran/goclaw-ui:latest"
                        read -p "Pin to specific node? (Leave blank for any): " LOCAL_NODE
                    fi

                    UI_CONTAINER_YAML=$(cat <<EOF
      - name: ui
        image: $UI_IMG
        imagePullPolicy: $PULL_POLICY
        ports: [ { containerPort: 80 } ]
EOF
)
                    ;;

                2)
                    AN="whisper"
                    START_CMD="uvicorn main:app --host 0.0.0.0 --port 8000"
                    H="true"
                    PORT="8000"
                    QMEM="2048Mi"
                    QCPU="500m"
                    SAFE_RUN_CMD="ln -sf /app/data/config.json /app/config.json 2>/dev/null; ln -sf /app/data/.env.local /app/.env.local 2>/dev/null; if [ -f /app/.env.local ]; then set -a; . /app/.env.local; set +a; fi; exec $START_CMD"

                    read -p "Auto-clone, build, and inject the Hailo Whisper AI image? (Recommended) [Y/n]: " AUTO_WHISPER
                    if [[ ! "$AUTO_WHISPER" =~ ^[Nn]$ ]]; then
                        log "Initializing Whisper AI Build Factory..."
                        if ! command -v git >/dev/null 2>&1; then wait_for_pkg_mgr; $PKG_MGR git >/dev/null 2>&1; fi

                        read -p "Target Node for deployment (e.g., dietpi): " LOCAL_NODE
                        NODE_STATUS=$(kubectl get node "$LOCAL_NODE" | awk 'NR==2 {print $2}')
                        if [[ -z "$NODE_STATUS" ]] || [[ "$NODE_STATUS" != *"Ready"* ]] || [[ "$NODE_STATUS" == *"NotReady"* ]]; then
                            err "Target node '$LOCAL_NODE' is offline or does not exist."
                        fi

                        rm -rf /tmp/whisper-hailo-8l-fastapi 2>/dev/null
                        log "Cloning MafiaCoconut/whisper-hailo-8l-fastapi from GitHub..."
                        (cd /tmp && git clone https://github.com/MafiaCoconut/whisper-hailo-8l-fastapi.git) || err "Failed to clone repository."

                        log "Compiling Whisper AI Container (This will take a few minutes)..."
                        (cd /tmp/whisper-hailo-8l-fastapi && docker build -t mafiacoconut/whisper-hailo-8l-fastapi:latest .) || err "Container build failed."

                        if [ "$CURRENT_HOSTNAME" == "$LOCAL_NODE" ]; then
                            log "Injecting directly into local K3s runtime cache..."
                            docker save mafiacoconut/whisper-hailo-8l-fastapi:latest | k3s ctr images import -
                        else
                            log "Target is remote. Initiating secure SCP bridge to $LOCAL_NODE..."
                            read -p "SSH Username for $LOCAL_NODE (e.g., dietpi): " REMOTE_USER
                            docker save mafiacoconut/whisper-hailo-8l-fastapi:latest > /tmp/whisper.tar
                            scp /tmp/whisper.tar "$REMOTE_USER@$LOCAL_NODE:/home/$REMOTE_USER/" || err "SCP Transfer failed!"
                            log "Executing remote cache injection..."
                            ssh "$REMOTE_USER@$LOCAL_NODE" "sudo k3s ctr images import /home/$REMOTE_USER/whisper.tar && rm /home/$REMOTE_USER/whisper.tar" || err "Remote import failed!"
                            rm /tmp/whisper.tar
                        fi

                        log "🎉 Whisper Build & Cache Pipeline Complete!"
                        IMG="mafiacoconut/whisper-hailo-8l-fastapi:latest"
                        PULL_POLICY="Never"
                    else
                        read -p "Image Name/URL [Default: mafiacoconut/whisper-hailo-8l-fastapi:latest]: " IMG
                        [ -z "$IMG" ] && IMG="mafiacoconut/whisper-hailo-8l-fastapi:latest"
                        read -p "Pin to specific node? (Leave blank for any): " LOCAL_NODE
                    fi
                    ;;
            esac

            if [[ -n "$LOCAL_NODE" || "$H" == "true" ]]; then
                SEL_YAML="      nodeSelector:"
                [[ -n "$LOCAL_NODE" ]] && SEL_YAML="$SEL_YAML\n        kubernetes.io/hostname: \"$LOCAL_NODE\""
                [[ "$H" == "true" ]] && SEL_YAML="$SEL_YAML\n        hardware.hailo: \"true\""
            fi

            INTERACTIVE_CMD_YAML=""
            read -p "Does this agent require an interactive CLI setup wizard on first boot? [y/N]: " NEEDS_SETUP

            if [[ "$NEEDS_SETUP" =~ ^[Yy]$ ]]; then
                info "Matrix Injection Activated. Agent will boot into Suspended Animation."
                INTERACTIVE_CMD_YAML="        command: [\"/bin/sh\", \"-c\", \"sleep infinity\"]"
            else
                INTERACTIVE_CMD_YAML="        command: [\"/bin/sh\", \"-c\", \"$SAFE_RUN_CMD\"]"
            fi

            if [ "$H" == "true" ]; then
                MNT_YAML="${MNT_YAML}\n        - name: hailo\n          mountPath: /dev/hailo0"
                VOL_YAML="${VOL_YAML}\n      - name: hailo\n        hostPath: { path: /dev/hailo0, type: CharDevice }"
            fi

            # --- TUNNEL INJECTION ---
            read -p "Use Tailscale sidecar instead of Cloudflare? [y/N]: " TS_MODE
            TUNNEL_CONTAINER_YAML=""
            if [[ "$TS_MODE" =~ ^[Yy]$ ]]; then
                read -s -p "Tailscale Auth Key (tskey-auth-...): " TS_KEY; echo ""
                kubectl create secret generic ${AN}-ts --from-literal=authkey="$TS_KEY" 2>/dev/null
                TUNNEL_CONTAINER_YAML="      - name: tailscale\n        image: tailscale/tailscale:latest\n        env:\n        - name: TS_AUTHKEY\n          valueFrom: { secretKeyRef: { name: ${AN}-ts, key: authkey } }\n        - { name: TS_EXTRA_ARGS, value: \"--advertise-tags=tag:k8s\" }\n        securityContext: { capabilities: { add: [ \"NET_ADMIN\" ] } }"
            else
                read -s -p "CF Token (Leave blank to skip): " CFT; echo ""
                if [ -n "$CFT" ]; then
                    kubectl create secret generic ${AN}-cf --from-literal=token="$CFT" 2>/dev/null
                    TUNNEL_CONTAINER_YAML="      - name: tunnel\n        image: cloudflare/cloudflared:$CLOUDFLARED_VERSION\n        command: [\"cloudflared\", \"tunnel\", \"--no-autoupdate\", \"run\"]\n        env:\n        - name: TUNNEL_TOKEN\n          valueFrom: { secretKeyRef: { name: ${AN}-cf, key: token } }\n        resources: { limits: { memory: \"256Mi\", cpu: \"200m\" }, requests: { memory: \"256Mi\", cpu: \"200m\" } }"
                fi
            fi

            kubectl label --overwrite ns default pod-security.kubernetes.io/enforce=privileged >/dev/null 2>&1
            MAN="$SECURE_VAULT/d.yaml"

            if [ "$AN" == "goclaw" ]; then
                SVC_PORTS="[ { port: 18790, targetPort: 18790, name: api }, { port: 80, targetPort: 80, name: ui } ]"
            else
                SVC_PORTS="[ { protocol: TCP, port: $PORT, targetPort: $PORT } ]"
            fi

            echo -e "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata: { name: ${AN}-pvc, namespace: default }\nspec: { accessModes: [ \"ReadWriteOnce\" ], storageClassName: longhorn, resources: { requests: { storage: 20Gi } } }" > "$MAN"
            echo -e "---\napiVersion: v1\nkind: Service\nmetadata: { name: ${AN}-svc, namespace: default }\nspec: { selector: { app: $AN }, ports: $SVC_PORTS, type: ClusterIP }" >> "$MAN"

            # --- GOCLAW DOCKER-COMPOSE COMPATIBILITY ALIAS ---
            if [ "$AN" == "goclaw" ]; then
                echo -e "---\napiVersion: v1\nkind: Service\nmetadata: { name: goclaw, namespace: default }\nspec: { selector: { app: goclaw }, ports: [ { port: 18790, targetPort: 18790 } ], type: ClusterIP }" >> "$MAN"
            fi

            echo -e "---\napiVersion: apps/v1\nkind: Deployment\nmetadata: { name: ${AN}-core, namespace: default }\nspec:\n  replicas: 1\n  selector: { matchLabels: { app: $AN } }\n  template:\n    metadata: { labels: { app: $AN } }\n    spec:" >> "$MAN"
            echo -e "      terminationGracePeriodSeconds: 30" >> "$MAN"
            [[ -n "$SEL_YAML" ]] && echo -e "$SEL_YAML" >> "$MAN"
            echo -e "      securityContext: { fsGroup: 1000 }" >> "$MAN"
            echo -e "      containers:\n      - name: agent\n        image: $IMG\n        imagePullPolicy: $PULL_POLICY" >> "$MAN"
            [[ -n "$INTERACTIVE_CMD_YAML" ]] && echo -e "$INTERACTIVE_CMD_YAML" >> "$MAN"
            echo -e "        securityContext: { privileged: true }\n        env:\n        - { name: TZ, value: \"UTC\" }" >> "$MAN"
            [[ -n "$APP_ENV_YAML" ]] && echo -e "        $APP_ENV_YAML" >> "$MAN"
            echo -e "        - { name: OTEL_EXPORTER_OTLP_ENDPOINT, value: \"http://otel-collector-svc:4317\" }\n        - { name: OTEL_SERVICE_NAME, value: \"$AN\" }\n        - { name: DATABASE_URL, value: \"$DSN_URL\" }\n        - { name: PGVECTOR_ENABLED, value: \"true\" }" >> "$MAN"
            echo -e "        resources:\n          limits: { memory: \"$QMEM\", cpu: \"$QCPU\" }\n          requests: { memory: \"$QMEM\", cpu: \"$QCPU\" }" >> "$MAN"
            echo -e "        ports: [ { containerPort: $PORT } ]\n        volumeMounts:\n        - { name: data, mountPath: /app/data }\n        - { name: shm, mountPath: /dev/shm }" >> "$MAN"
            [[ -n "$MNT_YAML" ]] && echo -e "        $MNT_YAML" >> "$MAN"
            [[ -n "$UI_CONTAINER_YAML" ]] && echo -e "$UI_CONTAINER_YAML" >> "$MAN"
            [[ -n "$TUNNEL_CONTAINER_YAML" ]] && echo -e "$TUNNEL_CONTAINER_YAML" >> "$MAN"
            echo -e "      volumes:\n      - name: data\n        persistentVolumeClaim: { claimName: ${AN}-pvc }\n      - name: shm\n        emptyDir: { medium: Memory, sizeLimit: $SHM }" >> "$MAN"
            [[ -n "$VOL_YAML" ]] && echo -e "$VOL_YAML" >> "$MAN"

            if kubectl apply -f "$MAN"; then
                if [[ "$NEEDS_SETUP" =~ ^[Yy]$ ]]; then
                    log "Waiting for pod to wake up in Suspended Animation..."
                    POD_NAME=$(kubectl get pods -l app=$AN -o jsonpath='{.items[0].metadata.name}')

                    WAIT_TIME=0
                    while [[ $(kubectl get pod $POD_NAME -o jsonpath='{.status.phase}') != "Running" ]]; do
                        echo -n "."
                        sleep 2
                        WAIT_TIME=$((WAIT_TIME+2))
                        if [ $WAIT_TIME -ge 120 ]; then
                            echo -e "\n${SET_BOLD}${SET_RED}[!] CRITICAL TIMEOUT: Pod failed to start after 120s.${SET_RESET}"
                            err "Run 'kubectl describe pod $POD_NAME' to investigate. Aborting."
                        fi
                    done

                    echo -e "\n${SET_BOLD}${SET_YELLOW}======================================================${SET_RESET}"
                    echo -e "${SET_BOLD}${SET_YELLOW}  ⚠️  PRE-FLIGHT BRIEFING: READ BEFORE PROCEEDING       ${SET_RESET}"
                    echo -e "${SET_BOLD}${SET_YELLOW}======================================================${SET_RESET}"
                    echo -e "${SET_CYAN}1. Start Wizard:${SET_RESET}   Run ${SET_BOLD}$START_CMD${SET_RESET}"
                    echo -e "${SET_CYAN}2. Database URL:${SET_RESET}   Paste this exact string:"
                    echo -e "   ${SET_GREEN}$DSN_URL${SET_RESET}"
                    echo -e "${SET_CYAN}3. PERSIST DATA:${SET_RESET}   Move config to SSD vault:"
                    echo -e "   ${SET_BOLD}mv /app/config.json /app/data/ 2>/dev/null || true${SET_RESET}"
                    echo -e "   ${SET_BOLD}mv /app/.env.local /app/data/ 2>/dev/null || true${SET_RESET}"
                    if [ "$AN" == "goclaw" ]; then
                        echo -e "${SET_CYAN}4. Migrations:${SET_RESET}     Run database schema upgrade:"
                        echo -e "   ${SET_BOLD}source /app/data/.env.local && /app/goclaw --config /app/data/config.json migrate up${SET_RESET}"
                    else
                        echo -e "${SET_CYAN}4. Migrations:${SET_RESET}     Link files and migrate:"
                        echo -e "   ${SET_BOLD}ln -sf /app/data/config.json /app/config.json; ln -sf /app/data/.env.local /app/.env.local${SET_RESET}"
                        echo -e "   ${SET_BOLD}source /app/.env.local && $START_CMD migrate up${SET_RESET}"
                    fi
                    echo -e "${SET_CYAN}5. Exit Pod:${SET_RESET}       Type ${SET_BOLD}exit${SET_RESET}"
                    echo -e "${SET_BOLD}${SET_YELLOW}======================================================${SET_RESET}"
                    read -p "Press Enter to Jack In..."

                    kubectl exec -it $POD_NAME -c agent -- /bin/sh

                    GATEWAY_TOKEN=""
                    if [ "$AN" == "goclaw" ]; then
                        GATEWAY_TOKEN=$(kubectl exec $POD_NAME -c agent -- grep "GOCLAW_GATEWAY_TOKEN" /app/data/.env.local 2>/dev/null | cut -d '=' -f2 | tr -d '"')
                    fi

                    log "Terminal disconnected. Injecting Engine Wrapper and Restoring..."
                    PATCH_JSON='[{"op": "replace", "path": "/spec/template/spec/containers/0/command", "value": ["/bin/sh", "-c", "'"$SAFE_RUN_CMD"'"]}]'
                    kubectl patch deployment ${AN}-core --type='json' -p="$PATCH_JSON" >/dev/null 2>&1
                fi

                echo -e "\n${SET_BOLD}${SET_GREEN}🎉 DEPLOYMENT SUCCESSFUL: ${AN^^} IS ONLINE!${SET_RESET}"
                echo -e "${SET_CYAN}--------------------------------------------------------${SET_RESET}"

                if [ "$AN" == "goclaw" ]; then
                    echo -e "${SET_BOLD}📡 Cloudflare Routes Required:${SET_RESET}"
                    echo -e "   - UI Dashboard:  Route to 127.0.0.1:80"
                    echo -e "   - API Backend:   Route to 127.0.0.1:18790 (if needed externally)"
                    echo -e "${SET_CYAN}--------------------------------------------------------${SET_RESET}"
                    echo -e "${SET_BOLD}🔑 GOCLAW FIRST LOGIN:${SET_RESET}"
                    echo -e "   - User ID:       ${SET_YELLOW}[You can type literally anything]${SET_RESET}"
                    if [ -n "$GATEWAY_TOKEN" ]; then
                        echo -e "   - Gateway Token: ${SET_YELLOW}$GATEWAY_TOKEN${SET_RESET}"
                    else
                        echo -e "   - Gateway Token: ${SET_YELLOW}(Run: kubectl exec deployment/goclaw-core -c agent -- grep GOCLAW_GATEWAY_TOKEN /app/data/.env.local)${SET_RESET}"
                    fi
                else
                    echo -e "${SET_BOLD}📡 Cloudflare Route:${SET_RESET} 127.0.0.1:$PORT"
                fi

                echo -e "${SET_CYAN}--------------------------------------------------------${SET_RESET}"
                echo -e "${SET_BOLD}📜 Live Logs Command:${SET_RESET} kubectl logs -f deployment/${AN}-core -c agent"
                echo -e "${SET_CYAN}--------------------------------------------------------${SET_RESET}"
            else
                err "Failed to deploy manifests."
            fi
            ;;

        5)
            log "📊 Phase 5: Cluster Health & Auto-Heal Engine"
            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); [ -n "$UH" ] && export KUBECONFIG="$UH/.kube/config"; fi

            echo -e "\n--- NODES ---"
            kubectl get nodes -o wide --show-labels
            echo -e "\n--- PODS ---"
            kubectl get pods -A -o wide
            echo -e "\n--- STORAGE ---"
            kubectl get pods -n longhorn-system | grep -v Completed | head -n 5

            # --- AUTO-HEAL DIAGNOSTICS ---
            BAD_PODS=$(kubectl get pods -A | grep -E 'Unknown|Evicted|Terminating|NodeLost' || true)
            if [ -n "$BAD_PODS" ]; then
                echo -e "\n${SET_BOLD}${SET_RED}⚠️  CRITICAL: GHOST PODS DETECTED${SET_RESET}"
                echo -e "Kubernetes has lost connection to some pods. These 'ghosts' are likely holding your SSD storage volumes hostage, preventing new pods from starting."
                echo -e "$BAD_PODS"
                echo ""
                read -p "Execute Surgical Purge to force-delete ghost pods and release storage locks? [y/N]: " HEAL_OPT
                if [[ "$HEAL_OPT" =~ ^[Yy]$ ]]; then
                    log "Initializing Surgical Purge..."
                    echo "$BAD_PODS" | while read -r line; do
                        NS=$(echo $line | awk '{print $1}')
                        POD=$(echo $line | awk '{print $2}')
                        kubectl delete pod $POD -n $NS --grace-period=0 --force 2>/dev/null
                        log "Purged: $POD in $NS"
                    done
                    log "✅ Purge complete. Longhorn storage volumes have been unlocked."
                    info "If new pods are still stuck, run 'sudo systemctl restart k3s-agent' on the affected worker node."
                else
                    info "Purge aborted. You must handle storage locks manually."
                fi
            else
                echo -e "\n${SET_BOLD}${SET_GREEN}✅ Cluster state is healthy. No ghost pods detected.${SET_RESET}"
            fi

            read -p "Press Enter to return to menu..." ;;

        6)
            log "🗑️ Phase 6: Purge Running Agent/Infra"
            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); [ -n "$UH" ] && [ -f "$UH/.kube/config" ] && export KUBECONFIG="$UH/.kube/config"; fi
            echo -e "Which target do you want to completely uninstall?"
            echo -e "1) GoClaw Stack (Backend + UI) | 2) Whisper API | 3) Core AI Infra (PGVector + OTel) | 4) Immich Photo Stack"
            read -p "Target [1-4]: " PURGE_OPT

            case $PURGE_OPT in
                1) TARGET_NAME="goclaw"; PURGE_TYPE="agent" ;;
                2) TARGET_NAME="whisper"; PURGE_TYPE="agent" ;;
                3) TARGET_NAME="core-infra"; PURGE_TYPE="infra" ;;
                4) TARGET_NAME="immich"; PURGE_TYPE="immich" ;;
                *) warn "Invalid selection."; continue ;;
            esac

            if [ "$PURGE_TYPE" == "agent" ]; then
                warn "Initiating surgical extraction of $TARGET_NAME..."
                kubectl delete deployment ${TARGET_NAME}-core --ignore-not-found=true
                kubectl delete svc ${TARGET_NAME}-svc --ignore-not-found=true
                kubectl delete svc ${TARGET_NAME} --ignore-not-found=true 2>/dev/null
                kubectl delete secret ${TARGET_NAME}-cf ${TARGET_NAME}-ts ${TARGET_NAME}-reg --ignore-not-found=true 2>/dev/null

                echo -e "${SET_BOLD}${SET_RED}WARNING: Deleting the storage volume will wipe all local agent memory!${SET_RESET}"
                read -p "Delete persistent data (PVC) for $TARGET_NAME? [y/N]: " DEL_PVC
                if [[ "$DEL_PVC" =~ ^[Yy]$ ]]; then
                    kubectl delete pvc ${TARGET_NAME}-pvc --ignore-not-found=true
                    log "Storage wiped clean."
                else
                    info "Storage preserved."
                fi
                log "✅ $TARGET_NAME has been purged."

            elif [ "$PURGE_TYPE" == "infra" ]; then
                warn "Initiating extraction of Core AI Infrastructure..."
                kubectl delete deployment pgvector otel-collector --ignore-not-found=true
                kubectl delete svc pgvector-svc otel-collector-svc --ignore-not-found=true
                kubectl delete secret pgvector-creds --ignore-not-found=true 2>/dev/null

                echo -e "${SET_BOLD}${SET_RED}CRITICAL WARNING: Deleting the pgvector PVC will wipe the UNIFIED vector database!${SET_RESET}"
                read -p "Delete unified vector data (PVC)? [y/N]: " DEL_PVC
                if [[ "$DEL_PVC" =~ ^[Yy]$ ]]; then
                    kubectl delete pvc pgvector-pvc --ignore-not-found=true
                    log "Core vector storage wiped clean."
                else
                    info "Core vector storage preserved."
                fi
                log "✅ Core AI Infra purged."

            elif [ "$PURGE_TYPE" == "immich" ]; then
                warn "Initiating extraction of Immich Enterprise Stack..."
                kubectl delete deployment immich-server immich-machine-learning immich-db immich-redis --ignore-not-found=true
                kubectl delete svc immich-server immich-db immich-redis --ignore-not-found=true
                kubectl delete secret immich-cf immich-creds --ignore-not-found=true 2>/dev/null

                read -p "Delete the local Immich database PVC (does not affect NFS media)? [y/N]: " DEL_PVC
                if [[ "$DEL_PVC" =~ ^[Yy]$ ]]; then
                    kubectl delete pvc immich-db-pvc --ignore-not-found=true
                    log "Database PVC destroyed."
                fi
                info "Notice: Your media data inside your NFS storage array remains untouched for safety."
                log "✅ Immich has been completely uninstalled from Kubernetes."
            fi
            ;;

        7)
            log "💾 Phase 7: Storage Engine Migration (Docker/K3s to NVMe/SSD)"
            warn "This will temporarily STOP Kubernetes and Docker to migrate their core databases."
            read -p "Proceed with migration? [y/N]: " PROCEED
            if [[ "$PROCEED" =~ ^[Yy]$ ]]; then
                echo -e "\n${SET_BOLD}Available Storage Drives:${SET_RESET}"
                df -h | grep -E '^/dev/' | grep -v 'loop' | grep -v 'tmpfs' | awk '{print "Drive: " $1 " | Mount: " $6 " | Total: " $2 " | Free: " $4}'
                echo ""

                MIGRATE_PATH=""
                while [[ -z "$MIGRATE_PATH" ]]; do read -p "Enter exact target mount path (e.g., /mnt/nvme3): " MIGRATE_PATH; done

                if [ ! -d "$MIGRATE_PATH" ]; then
                    err "Path $MIGRATE_PATH does not exist! Check your spelling or mount the drive first."
                fi

                log "Stopping container engines..."
                systemctl stop k3s 2>/dev/null || true
                systemctl stop k3s-agent 2>/dev/null || true
                systemctl stop docker 2>/dev/null || true
                systemctl stop containerd 2>/dev/null || true

                log "Creating Storage Vaults on $MIGRATE_PATH..."
                mkdir -p "$MIGRATE_PATH/docker_data"
                mkdir -p "$MIGRATE_PATH/rancher_data"

                if [ -d "/var/lib/docker" ] && [ ! -L "/var/lib/docker" ]; then
                    log "Migrating Docker core data to $MIGRATE_PATH/docker_data..."
                    rsync -aP /var/lib/docker/ "$MIGRATE_PATH/docker_data/"
                    mv /var/lib/docker /var/lib/docker.bak
                    ln -s "$MIGRATE_PATH/docker_data" /var/lib/docker
                else
                    info "Docker already migrated or not found."
                fi

                if [ -d "/var/lib/rancher" ] && [ ! -L "/var/lib/rancher" ]; then
                    log "Migrating K3s/Rancher core data to $MIGRATE_PATH/rancher_data..."
                    rsync -aP /var/lib/rancher/ "$MIGRATE_PATH/rancher_data/"
                    mv /var/lib/rancher /var/lib/rancher.bak
                    ln -s "$MIGRATE_PATH/rancher_data" /var/lib/rancher
                else
                    info "K3s/Rancher already migrated or not found."
                fi

                log "Re-igniting container engines..."
                systemctl start containerd 2>/dev/null || true
                systemctl start docker 2>/dev/null || true
                systemctl start k3s-agent 2>/dev/null || true
                systemctl start k3s 2>/dev/null || true

                log "✅ Storage Migration Complete! Your AI builds will now run at SSD/NVMe speeds."

                read -p "Delete the old backups off the SD card right now to reclaim space? [y/N]: " DEL_BAK
                if [[ "$DEL_BAK" =~ ^[Yy]$ ]]; then
                    rm -rf /var/lib/docker.bak 2>/dev/null
                    rm -rf /var/lib/rancher.bak 2>/dev/null
                    log "Backups deleted. SD card space reclaimed!"
                else
                    info "Backups preserved. You can delete them later manually if you need space."
                fi
            fi
            ;;

        8) exit 0 ;;
        *) err "Invalid." ;;
    esac
done
```

***

## 🧬 The Evolution Script: The Omega Protocol (Autoupdater)

Once your base cluster is running, your AI agents (like GoClaw) need to evolve autonomously. If an agent needs `ffmpeg` to process audio, you can't SSH in every time.

This script is the **Autonomous K3s Updater**. It runs via a nightly Cron job, pulls the latest source code, dynamically builds a new Docker image, injects any requested system tools, and handles upstream build failures gracefully (The "Soft-Fail").

```bash
#!/bin/bash
# ==============================================================================
# GOCLAW AUTONOMOUS K3S UPDATER (Resilient Build & Tool-Injecting)
# ==============================================================================
# Explicitly set KUBECONFIG to bypass sudo environment scrubbing
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
GOCLAW_DIR="/home/dietpi/goclaw"
PKG_CONF="/home/dietpi/goclaw-packages.conf"

# 1. Initialize the package config file
if [ ! -f "$PKG_CONF" ]; then
    echo "ca-certificates git curl jq ffmpeg build-base sqlite postgresql-client zip unzip pandoc hugo lynx imagemagick ripgrep" > "$PKG_CONF"
fi

FORCE_BUILD=false
NEW_PACKAGES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE_BUILD=true; shift ;;
        --add-apt)
            shift
            while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do NEW_PACKAGES="$NEW_PACKAGES $1"; shift; done
            FORCE_BUILD=true ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

cd "$GOCLAW_DIR" || exit 1
git reset --hard origin/main >/dev/null 2>&1
git fetch origin main >/dev/null 2>&1

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse FETCH_HEAD)

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ] || [ "$FORCE_BUILD" == "true" ]; then
    echo "$(date): Initiating Omega Protocol Build..."
    git pull origin main

    docker build -t mrnaran/goclaw:base . || { echo "❌ FATAL: Backend build failed!"; exit 1; }

    # Soft-Fail UI Build: Warn if it fails (e.g., upstream TS errors), but proceed with Backend
    echo "$(date): Compiling UI (Soft-fail enabled)..."
    UI_SUCCESS=false
    if docker build -t mrnaran/goclaw-ui:latest ./ui/web; then
        UI_SUCCESS=true
    else
        echo "⚠️ WARNING: UI build failed (Upstream Rot detected). Proceeding with backend agent only."
    fi

    # The Tool Injection & "Shotgun" Path Fix
    CURRENT_PACKAGES=$(cat "$PKG_CONF")
    UNIQUE_PACKAGES=$(echo "$CURRENT_PACKAGES $NEW_PACKAGES" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)

    cat << EOF > Dockerfile.omega
FROM mrnaran/goclaw:base
USER root
# Ensure PATH is ubiquitous for Go binaries doing os/exec
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Install tools and shotgun-symlink git to bypass "Clean Room" execution bugs
RUN apk update && apk add --no-cache $UNIQUE_PACKAGES && \
    ln -sf /usr/bin/git /usr/local/bin/git && \
    ln -sf /usr/bin/git /bin/git && \
    ln -sf /usr/bin/git /usr/sbin/git && \
    rm -rf /var/cache/apk/*
USER goclaw
EOF

    if docker build -t mrnaran/goclaw:latest -f Dockerfile.omega .; then
        echo "$UNIQUE_PACKAGES" > "$PKG_CONF"
        docker save mrnaran/goclaw:latest | sudo k3s ctr images import -
        if [ "$UI_SUCCESS" = true ]; then
            docker save mrnaran/goclaw-ui:latest | sudo k3s ctr images import -
        fi

        # Explicitly pass --kubeconfig to bypass the "Linux Lie"
        sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml rollout restart deployment goclaw-core -n default
        echo "$(date): 🎉 Upgrade & Tool Injection complete."
    else
        exit 1
    fi
else
    echo "$(date): Agent is up to date."
fi
```

***

## 🛠️ The Platinum Troubleshooting Guide

When you blend Edge AI hardware with distributed Kubernetes, things get spicy. If your infrastructure isn't behaving, check these critical failure domains.

### 💀 1. The "Deadlock" Protocol: The "Init:0/6" Standoff

When deploying **Cilium eBPF** on hardened hardware (like an encrypted Lenovo m700q), you might find your pods stuck in `Init:0/6`. The network engine is trying to mount its memory maps, but the encrypted kernel hasn't "trusted" the container runtime yet.

* **The Manual Mount:** `sudo mount -t bpf bpf /sys/fs/bpf`
* **The Permanent Solution:** Add `bpffs /sys/fs/bpf bpf defaults 0 0` to your `/etc/fstab`.

### 👻 2. The "Sudo" Environment Trap (Ghost Cluster)

**The Symptom:** You run `sudo kubectl get pods` and get a wall of red text: `The connection to the server localhost:8080 was refused`.

**The Cause ("The Linux Lie"):** When you use `sudo`, Linux aggressively scrubs your environment variables for security. Even if you exported `KUBECONFIG`, `sudo` strips it away. `kubectl` falls back to the default (non-existent) `localhost:8080`.

**The Fix:** Never rely on exported variables with sudo in automation. Always pass the flag explicitly:

```bash
sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get pods -n default
```

### 🧱 3. The Disk Pressure Deadlock & Zombie Pods

**The Symptom:** Your pods are stuck in `Pending` and `ContainerStatusUnknown`. The Events log says: `1 node(s) had untolerated taint {node.kubernetes.io/disk-pressure: }`.

**The Cause:** Edge nodes (like Raspberry Pis) have small disks. When Docker build caches or system journals fill the disk to 90%, the Kubelet panics, taints the node to prevent new pods from crashing the OS, and effectively locks your Longhorn storage volumes to a "Zombie" pod that it refuses to kill.

**The Fix (The 3-Step Clean):** Execute this on the affected Worker Node to free space immediately:

```bash
sudo journalctl --vacuum-size=50M
sudo docker system prune -f
sudo apt-get clean
```

Then, use **Phase 5 (Auto-Heal Engine)** in the main script, or surgically terminate the Zombie pod from the Master to release the storage lock:

```bash
sudo kubectl delete pod <zombie-pod-name> -n default --grace-period=0 --force
```

### 🔌 4. The Missing Translator: CSI Driver Failure

**The Symptom:** Pods transition to `ContainerCreating` but hang forever. The Events log shows: `AttachVolume.Attach failed... CSINode dietpi does not contain driver driver.longhorn.io`.

**The Cause:** After a disk-pressure event, the Longhorn CSI "Translator" pod on the worker node crashed. Kubernetes is asking the node to mount the NVMe, but the node forgot how to speak "Longhorn."

**The Fix:** Force the Kubelet to re-register its drivers by restarting the agent on the Worker node:

```bash
sudo systemctl restart k3s-agent
```

Wait 60 seconds, then delete the stuck pod on the Master node to force a fresh attachment retry.

### 🕵️‍♂️ 5. Contextual Isolation: The "Command Not Found" Illusion

**The Symptom:** You `exec` into your agent pod, type `git` or `ffmpeg`, and it works perfectly. But when you ask the AI Agent to use the tool, it replies: `Blocked. git command not found.`

**The Cause ("The Clean Room" Problem):** You are logging into the pod's shell as `root` (which has a full `PATH`). But the Go binary running your AI agent executes as a restricted user (`goclaw`) and uses `os/exec`. Many Go applications do not inherit the shell's `PATH` and instead execute in a "Clean Room" environment.

**The Fix:** You must enforce deterministic environments in your Dockerfile. Use the "Shotgun Symlink" approach (seen in the Omega Protocol script above) to force binaries into every conceivable path (`/bin`, `/usr/bin`, `/usr/local/bin`) and hardcode the `ENV PATH` directly into the image layers.

### 🐢 6. The PCIe Bottleneck (Stuck at Gen 2.0)

**The Symptom:** Your Hailo-8 NPU is running inference slowly. Run `sudo lspci -vvv | grep -A 20 "Hailo" | grep "LnkSta:"` and see `Speed 5GT/s (downgraded)`.

**The Cause & Fix:** The Raspberry Pi 5 is highly sensitive to "Signal Integrity." Power down, unlatch the PCIe ribbon cable, ensure it is perfectly straight, and reseat it.

### 🧠 7. "Is the Brain Awake?" (Verifying the NPU)

**The Symptom:** Your Omni-Agent pod deploys but uses CPU instead of the NPU.
**The Fix:** Check if `/dev/hailo0` exists. If missing, your `hailo-all` DKMS package needs to be recompiled. Run `sudo apt install linux-headers-$(uname -r)` and reinstall.

***

## 💡 The Golden Rule of Edge AI Infrastructure

> _"In the cloud, you manage software. At the Edge, you manage physics. Kubernetes assumes the hardware is perfect, but the hardware is never perfect. Between PCIe bandwidth throttling, encrypted NVMe deadlocks, and disk-pressure taints, you aren't just deploying containers—you are negotiating with the kernel."_
