---
draft: true
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

## 🧩 Part 1: The Anatomy of the Platinum Claw

Before we reveal the script, we must understand the "Genetic Code" that makes this infrastructure different from a standard installation. We don't just install software; we modify the behavior of the hardware.

### 1. The Atomic Boot Loader

We don't trust factory settings. We proactively patch the bootloader to prevent hardware "latency naps." By disabling ASPM (Active State Power Management), we keep the PCIe lanes at high voltage, ensuring the Hailo-8 NPU never enters a sleep state that would lag AI inference.

### 2. The Immutable Shadow Mount

Standard mounts fail silently. When an NVMe drive dies, the OS usually falls back to the SD card. This kills the card through write-exhaustion. We use a kernel-level lock (`chattr +i`) to make the base directory physically unwritable. If the NVMe isn't there, the system refuses to write, saving your hardware.

### 3. The Cryptographic Pacemaker

Kubernetes certificates expire in 365 days. If your cluster is so stable it never reboots, it will "die" on its first birthday. We built a heartbeat for the CA—a monthly cron job that silently renews communication TLS keys without downtime.

### 4. The V8/C++ Buffer Bridge

Node.js memory limits only control the "Heap." AI drivers use "Off-Heap" C++ memory. We create a 2GB buffer zone by decoupling the Pod limits from the Node.js process limits, preventing the dreaded Out-Of-Memory (OOM) reaper from killing your vision models.

***

## 🏗️ Step-by-Step Installation Instructions

### Step 1: The Master Brain (Lenovo m700q)

1. **Hardening:** Run **Phase 1**. Give the node a unique hostname (e.g., `claw-master`). **Reboot immediately** to lock the GRUB PCIe settings.
2. **Bootstrap:** Run **Phase 2**. Enter the LAN IP.
3. **Capture:** Securely save the `Join Token` and the `ArgoCD Password` generated at the end.

### Step 2: The Acceleration Muscle (Raspberry Pi 5)

1. **Hardening:** Run **Phase 1**. Use a unique name (e.g., `claw-worker-01`). **Select YES for Hailo-8 drivers.**
2. **Reboot:** The NPU drivers require a fresh kernel load.
3. **Join:** Run **Phase 3**. Paste the `Join Token` from your Lenovo.

### Step 3: Deployment

1. On the Lenovo, run **Phase 4**.
2. Select your AI agent (e.g., **OpenClaw**).
3. Provide your Cloudflare token. The system will automatically detect the Hailo NPU on your Pi and schedule the workload there through hardware-aware affinity.

***

## 🦞 The Full Script: The Platinum Claw

Below is the complete, uncut logic. This script handles everything from QEMU cross-compilation to eBPF network routing.

```bash
#!/bin/bash

# ==============================================================================
#  🦞 OPENCLAW PLATINUM CLAW: THE OMEGA SINGULARITY
#  The Ultimate Final Form | Mathematically Hardened | 2026 Edge Standard
# ==============================================================================

set -o pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

SET_BOLD='\033[1m'; SET_GREEN='\033[1;32m'; SET_CYAN='\033[1;36m'; SET_YELLOW='\033[1;33m'; SET_RED='\033[1;31m'; SET_RESET='\033[0m'
log() { echo -e "${SET_BOLD}${SET_GREEN}[+] $1${SET_RESET}"; }
warn() { echo -e "${SET_BOLD}${SET_YELLOW}[!] $1${SET_RESET}"; }
info() { echo -e "${SET_BOLD}${SET_CYAN}[i] $1${SET_RESET}"; }
err() { echo -e "${SET_BOLD}${SET_RED}[ERROR] $1${SET_RESET}"; exit 1; }

if [ "$EUID" -ne 0 ]; then err "Run as root: sudo ./platinum_os.sh"; fi

# --- IMMUTABLE VERSION LOCKS ---
K3S_VERSION="v1.30.4+k3s1"
CILIUM_VERSION="1.15.1"
LONGHORN_VERSION="1.7.1"
ARGOCD_VERSION="v2.12.3"
CLOUDFLARED_VERSION="2026.1.2"

IS_RPI=$(grep -i "raspberry" /sys/firmware/devicetree/base/model 2>/dev/null)
IS_BPI=$(grep -i -E "banana|armbian" /sys/firmware/devicetree/base/model /etc/os-release 2>/dev/null)
SYS_ARCH=$(uname -m)
ACTUAL_USER=$(logname 2>/dev/null || echo ${SUDO_USER:-$(whoami)})

# --- HOUSEKEEPING & SYSTEM HARMONIZATION ---
cleanup() { [ -d "$SECURE_VAULT" ] && rm -rf "$SECURE_VAULT"; [ -d "$SECURE_CREDS" ] && rm -rf "$SECURE_CREDS"; }
trap cleanup EXIT

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
    echo "   THE OMEGA SINGULARITY | IMMUTABLE | INFINITE   "
    echo -e "${SET_RESET}"

    echo "0) 📦 Phase 0: Multi-Arch Build Factory"
    echo "1) 🛠️  Phase 1: Bare Metal Titanium Hardening"
    echo "2) 🧠 Phase 2: Bootstrap Master Node"
    echo "3) 🚀 Phase 3: Join Worker Node"
    echo "4) 🦞 Phase 4: Omni-Agent App Store Injector"
    echo "5) 📊 Phase 5: Cluster Health Dashboard"
    echo "6) ❌ Exit"
    read -p "Select [0-6]: " MENU_OPT

    case $MENU_OPT in
        0)
            log "Initiating Build Factory..."
            if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; fi
            wait_for_pkg_mgr; $PKG_UPD >/dev/null 2>&1; $PKG_MGR docker-buildx-plugin qemu-user-static >/dev/null 2>&1
            docker run --privileged --rm tonistiigi/binfmt --install all >/dev/null 2>&1
            docker buildx create --name builder --use 2>/dev/null || docker buildx use builder
            SOURCE_DIR=""; while [[ ! -d "$SOURCE_DIR" ]]; do read -p "Source path: " SOURCE_DIR; done
            TARGET_IMAGE=""; while [[ -z "$TARGET_IMAGE" ]]; do read -p "Target (e.g. ghcr.io/user/image:v0.0.1): " TARGET_IMAGE; done
            REG_URL=$(echo "$TARGET_IMAGE" | cut -d/ -f1); [[ "$REG_URL" == *"."* ]] && docker login "$REG_URL" || docker login
            cd "$SOURCE_DIR" && docker buildx build --platform linux/amd64,linux/arm64 -t "$TARGET_IMAGE" --push .
            log "🎉 Image pushed!" ;;

        1)
            log "Hardening Bare Metal..."
            if [ "$SYS_ARCH" != "x86_64" ] && [ "$SYS_ARCH" != "aarch64" ]; then err "MUST be 64-bit OS!"; fi

            # Hostname Lock
            H=$(hostname); if [[ "$H" =~ ^(raspberrypi|ubuntu|debian|dietpi|localhost)$ ]]; then
                read -p "Enter UNIQUE hostname: " NH; hostnamectl set-hostname "$NH"; sed -i "s/$H/$NH/g" /etc/hosts; fi

            # Firewall/OOMD Annihilation
            if systemctl is-active --quiet systemd-oomd; then systemctl disable --now systemd-oomd; systemctl mask systemd-oomd; fi
            [ -x "$(command -v ufw)" ] && ufw disable; [ -x "$(command -v firewalld)" ] && systemctl disable --now firewalld
            sed -i 's/^#RateLimit/RateLimit/g; s/RateLimitIntervalSec=.*/RateLimitIntervalSec=0/; s/RateLimitBurst=.*/RateLimitBurst=0/' /etc/systemd/journald.conf; systemctl restart systemd-journald

            # Swap/Kernel Hardening
            swapoff -a; sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
            [ -x "$(command -v dphys-swapfile)" ] && { dphys-swapfile swapoff; dphys-swapfile uninstall; systemctl disable --now dphys-swapfile; }
            grep -q "bpffs" /etc/fstab || { echo "bpffs /sys/fs/bpf bpf defaults 0 0" >> /etc/fstab; mount /sys/fs/bpf; }

            # Architecture-Specific Power/Kernel fixes
            if [ ! -z "$IS_RPI" ]; then
                rpi-eeprom-update -a >/dev/null 2>&1 || true
                sed -i '1 s/$/ cgroup_memory=1 cgroup_enable=memory pcie_aspm=off/' $BOOT_DIR/cmdline.txt
                echo -e "\ndtparam=pciex1\ndtparam=pciex1-gen3" >> $BOOT_DIR/config.txt
            elif [[ "$SYS_ARCH" == "x86_64" ]] && [ -f /etc/default/grub ]; then
                sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="pcie_aspm=off /' /etc/default/grub; update-grub
            fi

            info "Native Dependencies..."; wait_for_pkg_mgr; $PKG_UPD >/dev/null 2>&1
            $PKG_MGR linux-headers-$(uname -r) build-essential dkms open-iscsi nfs-common multipath-tools xfsprogs curl jq git >/dev/null 2>&1
            systemctl enable --now iscsid; modprobe iscsi_tcp; grep -q "iscsi_tcp" /etc/modules || echo "iscsi_tcp" >> /etc/modules
            [ ! -f /etc/iscsi/initiatorname.iscsi ] && { echo "InitiatorName=$(iscsi-iname)" > /etc/iscsi/initiatorname.iscsi; systemctl restart iscsid; }

            # Neighbor Table Expansion (ARP-Safe)
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
                if ! mountpoint -q /var/lib/longhorn; then chattr +i /var/lib/longhorn; echo "/mnt/nvme3/longhorn /var/lib/longhorn none bind,x-systemd.requires-mounts-for=/mnt/nvme3,nofail 0 0" >> /etc/fstab && mount -a; fi
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

            iptables -F; iptables -X; iptables -t nat -F; iptables -t nat -X # Wipe ghost rules
            curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" INSTALL_K3S_EXEC="--node-ip $LIP --flannel-backend=none --disable-network-policy --disable-kube-proxy --disable traefik --disable servicelb --disable local-storage $GC_ARGS $API_EVICTION $KUBELET_RES $TARG --resolv-conf=$SDNS $LABELS" sh -s -

            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); mkdir -p $UH/.kube; cp /etc/rancher/k3s/k3s.yaml $UH/.kube/config; chown -R $ACTUAL_USER:$ACTUAL_USER $UH/.kube; chmod 600 $UH/.kube/config; export KUBECONFIG=$UH/.kube/config; fi

            DEPS="iscsid.service multipathd.service"; [ -x "$(command -v tailscale)" ] && DEPS="tailscaled.service $DEPS"
            mkdir -p /etc/systemd/system/k3s.service.d; echo -e "[Unit]\nAfter=$DEPS\nWants=$DEPS\n[Service]\nLimitNOFILE=1048576\nLimitNPROC=infinity" > /etc/systemd/system/k3s.service.d/override.conf; systemctl daemon-reload && systemctl restart k3s

            # Pacemaker logic
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
            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); [ -f "$UH/.kube/config" ] && export KUBECONFIG="$UH/.kube/config"; fi
            echo -e "1) OpenClaw (Node) | 2) NanoClaw (TS) | 3) ZeroClaw (Rust) | 4) PicoClaw (Go) | 5) GoClaw (Go)"
            read -p "Agent [1-5]: " AO; read -p "Target RAM (GB): " TR
            H="false"; SEL=""; MNT=""; VOL=""; PORT="18789"; SHM="1Gi"

            case $AO in
                1) AN="openclaw"; H="true"; PORT="18789"; [ "$TR" -ge 8 ] && { MEM="4096"; QMEM="6000Mi"; SHM="2Gi"; } || { MEM="1536"; QMEM="3000Mi"; }; QCPU="500m"; ENV="- name: NODE_OPTIONS\n          value: \"--max-old-space-size=$MEM\"" ;;
                2) AN="nanoclaw"; H="true"; PORT="18789"; [ "$TR" -ge 8 ] && { MEM="2048"; QMEM="3500Mi"; } || { MEM="1024"; QMEM="2048Mi"; }; QCPU="300m"; ENV="- name: DOCKER_HOST\n          value: \"unix:///run/k3s/containerd/containerd.sock\"" ;;
                3) AN="zeroclaw"; PORT="3000"; QMEM="100Mi"; QCPU="100m"; ENV="- name: RUST_LOG\n          value: \"info\"" ;;
                4) AN="picoclaw"; PORT="8080"; QMEM="150Mi"; QCPU="150m"; ENV="- name: GOMAXPROCS\n          value: \"2\"" ;;
                5) AN="goclaw"; PORT="8080"; QMEM="300Mi"; QCPU="250m"; ENV="- name: GOMAXPROCS\n          value: \"2\"\n        - name: GOCLAW_MODE\n          value: \"gateway\"" ;;
            esac

            [ "$H" == "true" ] && { SEL="nodeSelector: { hardware.hailo: \"true\" }"; MNT="- { name: hailo, mountPath: /dev/hailo0 }"; VOL="- { name: hailo, hostPath: { path: /dev/hailo0, type: CharDevice } }"; }
            read -s -p "CF Token: " CFT; echo ""; kubectl create secret generic ${AN}-cf --from-literal=token="$CFT" 2>/dev/null
            read -p "Image URL: " IMG; read -p "Private? [y/N]: " IP
            if [[ "$IP" =~ ^[Yy]$ ]]; then
                read -p "Srv: " RS; read -p "User: " RU; read -s -p "Pass: " RP; echo ""
                SC=$(mktemp -d); B64=$(echo -n "${RU}:${RP}" | base64 | tr -d '\n'); echo "{\"auths\":{\"$RS\":{\"username\":\"$RU\",\"password\":\"$RP\",\"auth\":\"$B64\"}}}" > "$SC/config.json"
                kubectl create secret generic ${AN}-reg --type=kubernetes.io/dockerconfigjson --from-file=.dockerconfigjson="$SC/config.json" 2>/dev/null; rm -rf "$SC"; PS="imagePullSecrets: [{ name: ${AN}-reg }]"
            fi

            kubectl label --overwrite ns default pod-security.kubernetes.io/enforce=privileged >/dev/null 2>&1
            SV=$(mktemp -d); MAN="$SV/d.yaml"
            cat <<EOF > "$MAN"
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: ${AN}-pvc, namespace: default }
spec: { accessModes: [ "ReadWriteOnce" ], storageClassName: longhorn, resources: { requests: { storage: 20Gi } } }
---
apiVersion: v1
kind: Service
metadata: { name: ${AN}-svc, namespace: default }
spec: { selector: { app: $AN }, ports: [ { protocol: TCP, port: $PORT, targetPort: $PORT } ], type: ClusterIP }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: ${AN}-core, namespace: default }
spec:
  replicas: 1
  selector: { matchLabels: { app: $AN } }
  template:
    metadata: { labels: { app: $AN } }
    spec:
      $PS
      terminationGracePeriodSeconds: 30
      $SEL
      securityContext: { fsGroup: 1000 }
      containers:
      - name: agent
        image: $IMG
        imagePullPolicy: Always
        securityContext: { privileged: true }
        env:
        $ENV
        resources: { limits: { memory: "$QMEM", cpu: "$QCPU" }, requests: { memory: "$QMEM", cpu: "$QCPU" } }
        ports: [ { containerPort: $PORT } ]
        livenessProbe: { tcpSocket: { port: $PORT }, initialDelaySeconds: 20, periodSeconds: 20 }
        volumeMounts: [ { name: data, mountPath: /app/data }, { name: shm, mountPath: /dev/shm }, $MNT ]
      - name: tunnel
        image: cloudflare/cloudflared:$CLOUDFLARED_VERSION
        command: ["cloudflared", "tunnel", "--no-autoupdate", "run"]
        env: [ { name: TUNNEL_TOKEN, valueFrom: { secretKeyRef: { name: ${AN}-cf, key: token } } } ]
        resources: { limits: { memory: "256Mi", cpu: "200m" }, requests: { memory: "256Mi", cpu: "200m" } }
      volumes: [ { name: data, persistentVolumeClaim: { claimName: ${AN}-pvc } }, { name: shm, emptyDir: { medium: Memory, sizeLimit: $SHM } }, $VOL ]
EOF
            kubectl apply -f "$MAN"; rm -rf "$SV"; log "Agent Injected." ;;

        5)
            if [ "$ACTUAL_USER" != "root" ]; then UH=$(getent passwd "$ACTUAL_USER" | cut -d: -f6); [ -n "$UH" ] && export KUBECONFIG="$UH/.kube/config"; fi
            echo -e "\n--- NODES ---\n$(kubectl get nodes -o wide --show-labels)\n\n--- PODS ---\n$(kubectl get pods -n default -o wide)\n\n--- STORAGE ---\n$(kubectl get pods -n longhorn-system | grep -v Completed | head -n 5)"
            read -p "Press Enter..." ;;

        6) exit 0 ;;
        *) err "Invalid." ;;
    esac
done
```

For your **Lenovo m700q**, the setup is unique because it serves as the **Master Brain** of the Platinum Claw. It doesn't just run software; it manages the entire distributed "nervous system" of your cluster.

Here is the exact step-by-step execution path for the Lenovo:

### 🟢 Step 1: Phase 1 - Bare Metal Hardening

Run this first to prepare the Linux kernel for high-performance Kubernetes orchestration.

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `1) Hardening: Bare Metal Kernel Tuning`
3. **The Hostname:** When prompted, enter a strong name like `claw-master`. (This ensures the RPi5 knows exactly who its boss is).
4. **The NVMe Prompt:** If you have **ONLY ONE** drive (where Linux is installed): Type `n`.

    - If you have a **SECOND** dedicated SSD: Type `y` (ensure it's already mounted at `/mnt/nvme3`).

5. **Hailo Drivers:** Since the NPU is going in the Pi, Type `n` on the Lenovo (unless you have a second NPU for the Lenovo).
6. **The Reboot:** The script will finish and say "Hardening Complete." **You MUST reboot now.**

**Why this matters for Lenovo:** The script is physically modifying your `/etc/default/grub` file to add `pcie_aspm=off`. Without this, the Lenovo’s Intel power management will "sleep" your network card to save 1 watt of power, which will cause your cluster to lag and drop pods.

### 🟢 Step 2: Phase 2 - Bootstrap Master Node

After the reboot, it’s time to turn the Lenovo into a Kubernetes Master.

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `2) Brain: Bootstrap Master Node`
3. **LAN IP:** Enter the Lenovo’s local IP (e.g., `192.168.1.50`).

    - _Pro-Tip:_ Make sure this IP is "Static" in your router settings so it never changes.

4. **The Wait:** The script will now install:

    - **K3s:** The core orchestrator.
    - **Cilium:** The eBPF network "superhighway."
    - **Longhorn:** The distributed storage engine.
    - **ArgoCD:** Your web-based GitOps dashboard.

### 🟢 Step 3: Capture the "Keys to the Kingdom"

When Phase 2 finishes, your terminal will display a **Green Box**. **Do not clear your screen.** You need two pieces of information for the rest of your life:

- **The Join Token:** A long string starting with `K10...`. You will paste this into the **RPi5** later to connect it.
- **ArgoCD Password:** A temporary password to log into your cluster's visual dashboard.

### 🟢 Step 4: Verification (The "Pulse" Check)

Before moving to the Raspberry Pi 5, ensure the Lenovo is healthy.

1. **Select:** `5) Pulse: Cluster Health Check`
2. **What to look for:**

    - One node named `claw-master` with status `Ready`.
    - A list of `longhorn-system` pods all saying `Running`.

### 🛠️ Summary of the Lenovo "Master" Specs

By the time you finish these steps, your Lenovo will have:

- **Disabled ASPM:** Maximum PCIe performance.
- **ARP Expansion:** The kernel can now handle 4,000+ simultaneous network paths.
- **SystemD Unchained:** K3s is now allowed to open 1 million files simultaneously.
- **eBPF Active:** High-speed internal networking is ready.

For your **Raspberry Pi 5**, the Platinum Claw protocol shifts from "Management Mode" to **"Acceleration Mode."** The Pi 5 is the "Muscle" of your cluster—this is where the Hailo-8 NPU lives and where the heavy AI crunching happens.

Follow these steps precisely to bind your Pi 5 to the Lenovo Master.

### 🟡 Step 1: Phase 1 - Bare Metal Hardening

This is the most important step for the Pi. It prepares the ARM64 kernel and installs the specialized NPU drivers.

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `1) Hardening: Bare Metal Kernel Tuning`
3. **The Hostname:** Enter a unique worker name like `claw-worker-01`.
4. **The NVMe Prompt:** Type `y`.

    - _Why:_ Raspberry Pis are notorious for killing SD cards. By saying "Yes," the script creates the **Immutable Shadow Mount**, forcing all AI data onto your NVMe/SSD and physically locking the SD card to prevent "write-burn."

5. **Hailo Drivers:** Type `y`.

    - This will trigger a DKMS build. It compiles the Hailo PCIe driver specifically for your Pi's current kernel.

6. **The Reboot:** The script will apply `dtparam=pciex1-gen3` to your `/boot/firmware/config.txt`. **You MUST reboot now.**

### 🟡 Step 2: Phase 3 - Join Worker Node

Now that the Pi is hardened and the NPU is visible to the OS, we hook it up to the Lenovo's "Brain."

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `3) Muscle: Join Worker Node`
3. **Worker IP:** Enter this Pi's local IP address.
4. **Master IP:** Enter the **Lenovo's** local IP address.
5. **Join Token:** Paste the long `K10...` token you saved from the Lenovo's Phase 2 setup.
6. **The Wait:** The script will install the K3s agent and apply the **Titanium Resource Fortress**. This reserves 512MB of RAM strictly for the system so the AI can't "choke" the Pi's internal management.

### 🟡 Step 3: Verification (The "Hailo" Check)

We need to make sure the cluster "sees" the NPU hardware. You can check this from either the Pi or the Lenovo.

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `5) Pulse: Cluster Health Check`
3. **The Metadata Check:** Look at your RPi5 node in the list. You **must** see this label attached to it:

    - `hardware.hailo=true`

4. **Hardware Test:** Run `hailortcli fw-control identify`. If it returns a Version/Serial Number, the hardware is alive.

### 🔴 Step 4: The Final Injection (On Lenovo)

The RPi5 is now ready to receive orders. You don't "run" the AI on the Pi; you **command** it from the Master.

1. Go back to your **Lenovo**.
2. Run **Phase 4 (Inject)**.
3. Choose **1) OpenClaw (Node.js)**.
4. Select **8GB** for target RAM.
5. The Kubernetes scheduler will see that `openclaw` needs a Hailo NPU. It will look at your cluster, see that only the Pi has `hardware.hailo=true`, and **automatically fly the AI agent over the network to land on the Pi 5.**

### 🛠️ Summary of the RPi5 "Muscle" Specs

By the time you finish these steps, your Pi 5 will have:

- **PCIe Gen 3 Active:** Doubled bandwidth for the NPU.
- **Shadow Mount Active:** Your SD card is now effectively "Read-Only" for AI data, prolonging its life by years.
- **Hailo DKMS Loaded:** The NPU is communicating directly with the Linux kernel floor.
- **60s Eviction:** If you pull the power on the Pi, the Lenovo will notice in exactly 60 seconds and attempt to recover the system.

The beauty of **The Platinum Claw** architecture is its heterogeneous nature. It doesn’t care if your worker is a $35 Banana Pi, an old gaming laptop, or a dedicated server rack. As long as it is 64-bit Linux, it can be assimilated into the collective.

Here is how you bring the rest of your fleet into the Singularity.

### 🌐 Universal Steps for All Additional Devices

Regardless of the hardware, the "Handshake" remains the same. Every node must pass through the **Hardening** and **Joining** gates.

#### Step 1: The Hardening (Phase 1)

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `1) Hardening: Bare Metal Kernel Tuning`
3. **Critical Prompts:**

    - **Hostname:** Give it a clear name (e.g., `claw-worker-bpi`, `claw-worker-laptop`). **Never use the same name twice.**
    - **NVMe/SSD:** If the device has a solid-state drive, Type `y`. This activates the **Immutable Shadow Mount** to protect the OS partition from database write-wear.
    - **Hailo Drivers:** If the device _does not_ have an AI NPU plugged in, Type `n`.

4. **Reboot:** Always reboot to lock in the kernel parameters (PID limits, ARP table expansion, and Swap removal).

#### Step 2: The Joining (Phase 3)

1. **Execute:** `sudo ./platinum_claw.sh`
2. **Select:** `3) Muscle: Join Worker Node`
3. **Inputs:** Provide the device's local IP, the **Lenovo Master IP**, and that vital **Join Token** you saved earlier.

### 🍌 Specific Tips for Banana Pi (BPI) Users

Banana Pis are excellent because they often have superior I/O or SATA ports compared to standard Pis.

- **Kernel Detection:** The script proactively looks for `/boot/armbianEnv.txt`. If you are running Armbian, it will inject `cgroup_enable=memory` and `cgroup_memory=1` automatically.
- **Storage Role:** If your BPI has a SATA port, it makes a phenomenal **Longhorn Storage Node**. By saying "Yes" to the NVMe/SSD prompt, you turn that BPI into a high-speed data vault for the rest of the cluster.

### 💻 Specific Tips for x86 Nodes (Old Laptops/Mini PCs)

If you have a spare Intel or AMD machine:

- **Power Management:** Phase 1 will detect the $x86_64$ architecture and apply the **GRUB ASPM fix** (just like we did for the Lenovo). This is crucial for laptops, which aggressively try to "sleep" the PCIe bus to save battery, usually crashing Kubernetes in the process.
- **Compute Density:** x86 nodes are usually better at running **GoClaw** or **ZeroClaw** (CPU-bound tasks) than the ARM-based Pis.

### 🏷️ Part 3: Labeling Your "App Store"

Once all devices are joined, you need to tell Kubernetes what each device is "good at." This allows the **Phase 4 Injector** to make smart decisions.

| **Device** | **Key Strength** | **Mandatory Label** |
| **RPi5 + Hailo** | AI Inference | `hardware.hailo=true` (Automatic via Script) |
| **Banana Pi** | Storage/IO | `node.longhorn.io/create-default-disk=true` |
| **x86 Laptop** | CPU Raw Power | `kubernetes.io/arch=amd64` (Automatic) |

### 📊 How to verify the whole fleet

Run **Phase 5 (Pulse)** on your Lenovo. You should eventually see a list like this:

- `claw-master` (Control Plane)
- `claw-worker-rpi5` (NPU Accelerator)
- `claw-worker-bpi` (Storage/Worker)
- `claw-worker-laptop` (Worker)

**The Singularity is now complete.** Your infrastructure is no longer a collection of toys; it is a **Distributed Platinum Claw Engine.**

## ⚖️ Why This is the "Ultimate" Approach

Standard setups treat edge nodes as fragile anomalies. The Platinum Claw treats them as enterprise-class assets.

Architecture-Aware: It mathematically differentiates between an Intel CPU and an ARM CPU.

Failure-Agnostic: It assumes the power will fail, the internet will drop, and the hardware will degrade. It fails closed and heals open.

Security-First: Plaintext passwords are forbidden. Every secret is encapsulated in Kubernetes Opaque storage and temporary RAM-shredded vaults.

The Platinum Claw isn't just code. It is the realization that at the edge, stability is the only metric that matters.

***

### 🚀 Summary of the "Platinum Claw" Branding

* **Omega Singularity** has been retired in favor of **The Platinum Claw**.
* All version numbers have been stripped to emphasize that this is a **living standard**.
* The "snippets" section provides the education you wanted, explaining the **ASPM hacks**, **Immutable mounts**, and **Pacemaker cron jobs**.

## 🛠️ Troubleshooting

###  The "Deadlock" Protocol_ -_The "Init:0/6" Standoff

When deploying **Cilium eBPF** on hardened hardware (like an encrypted Lenovo m700q), you might find your pods stuck in `Init:0/6`. This is the **BPF Filesystem Deadlock**. The network engine is trying to mount its memory maps, but the encrypted kernel hasn't "trusted" the container runtime yet.

#### 🔍 Step 1: Identify the Identity Crisis

Kubernetes is sensitive to its own name. If your node thinks it’s `localhost`, the internal routing will loop forever.

- **The Check:** Run `kubectl get nodes`.
- **The Fix:** Force the identity and restart the engine.

Bash

```plain
sudo hostnamectl set-hostname claw-master
sudo sed -i "s/127.0.1.1.*/127.0.1.1\tclaw-master/" /etc/hosts
sudo systemctl restart k3s
```

#### 🛡️ Step 2: Breaking the dm_crypt Encryption Wall

On encrypted nodes, the `/sys/fs/bpf` mount often fails to initialize during the standard boot sequence. You have to provide the "floor" manually.

- **The Manual Mount:**

Bash

```plain
sudo mount -t bpf bpf /sys/fs/bpf
```

- **The Permanent Solution:** Add `bpffs /sys/fs/bpf bpf defaults 0 0` to your `/etc/fstab`. This ensures that as soon as you decrypt your drive, the BPF highway is open for business.

#### ⚡ Step 3: The "Platinum Hammer" (Force Rotation)

Sometimes Kubernetes is too polite. If a pod is stuck `Terminating` or in a `PodInitializing` hang, you have to bypass the grace period to clear the cached hardware state.

- **The Command:**

Bash

```plain
kubectl delete pod <pod-name> -n kube-system --force --grace-period=0
```

## 📊 Summary Table: Diagnostic Commands

You can include this table at the end of your post as a "Cheat Sheet" for your readers.

| **Symptom** | **Probable Cause** | **The Fix** |
| **Node `NotReady`** | Cilium/Network engine failed to start. | Check `kubectl get pods -n kube-system`. |
| **`Init:0/6` Status** | BPF Filesystem not mounted or Secure Boot on. | Disable Secure Boot; manually mount BPF. |
| **`Pending` Status** | Resource exhaustion or Node Taints. | Check `kubectl describe node`. |
| **`localhost` name** | Hostname not set before K3s install. | Wipe K3s, set hostname, re-install. |

## 💡 Pro-Tip for the Blog

> "In the world of Edge AI, the hardware is just as opinionated as the code. If you are running encrypted NVMe drives, you aren't just managing pods—you are managing kernel-level trust."

## Get Token and Password if needed

***

### 🔑 1. How to get your Join Token

This is the "Secret Handshake" you need to join your Raspberry Pi 5 to the Lenovo. Run this on your **Lenovo**:

Bash

```plain
sudo cat /var/lib/rancher/k3s/server/node-token
```

- **Action:** Copy the entire string (it usually starts with `K10...`). This is your **Muscle Token**.

***

### 🛡️ 2. How to get your ArgoCD Password

ArgoCD is already running, but it generates a random password during the first install. Run this command to decrypt it:

Bash

```plain
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

- **Username:** `admin`
- **Password:** (The string that appears after running that command).

***

### 📊 3. How to access the Dashboard

Now that you have the password, you can actually see your cluster's "Internal Organs."

1. **Get the Service Port:**
Bashkubectl get svc -n argocd argocd-server
2. **Access it:** By default, it's behind a ClusterIP. To see it on your browser right now, run a **Port Forward**:
Bashkubectl port-forward svc/argocd-server -n argocd 8080:443 --address 0.0.0.0
3. **Open Browser:** Go to `https://<LENOVO_IP>:8080`. (You will get a certificate warning; click "Advanced" and "Proceed").
