# NetSplit — Routing Limitations & Compatibility Guide

**Date:** 2026-10-14  
**Target OS:** Windows 11 x64 (Compatible with Windows 10 x64)  
**Status:** Authoritative Technical Constraints  

---

## 1. Scope & Transparency Guarantee

NetSplit is engineered to provide genuine, verifiable per-application network adapter binding. Unlike commercial marketing claims that promise "universal one-click routing for everything", Windows networking stack architecture imposes specific documented boundaries. This document details supported capabilities, edge cases, and known architectural limitations.

---

## 2. Supported Scenarios

| Protocol / Scenario | Support Level | Implementation Mechanism | Notes |
| :--- | :--- | :--- | :--- |
| **Outbound TCP Connections** | **Full** | WFP ALE Connect Redirect + `IP_UNICAST_IF` / `bind()` | Standard desktop apps (browsers, Discord, Steam, Spotify, downloaders). |
| **Outbound UDP Traffic** | **Full** | `IP_UNICAST_IF` socket binding | DNS queries, voice chat, game telemetry, streaming audio/video. |
| **IPv4 Dual-Stack** | **Full** | `IP_UNICAST_IF` + IPv4 unicast binding | Tested across Wi-Fi 6, Gigabit Ethernet, and USB Tethering. |
| **IPv6 Dual-Stack** | **Supported** | `IPV6_UNICAST_IF` + IPv6 unicast binding | Requires active IPv6 gateway on designated interface. |
| **Multi-Process Executables** | **Full** | Shared Application Groups | Multiple binary paths mapped deterministically to one adapter. |
| **Adapter Disconnect Kill-Switch** | **Full** | WFP `FWP_ACTION_BLOCK` filter | Prevents IP leakage when designated adapter drops. |
| **Adapter Failover Mode** | **Full** | Dynamic fallback to Windows Default Route | Optional configuration per rule. |

---

## 3. Detailed Architectural Limitations

### 3.1 Launchers vs Game Executables (Multi-Process Splitting)
Modern games frequently use separate binaries for the launcher, authentication service, anti-cheat client, and actual 3D game engine:

- **Example 1: Riot Games / VALORANT**
  - Launcher: `RiotClientServices.exe`
  - Anti-Cheat: `vgk.sys` (Riot Vanguard Kernel Service)
  - Game Engine: `VALORANT-Win64-Shipping.exe`
  - *Limitation & Guidance:* Assigning only `RiotClientServices.exe` will route launcher patch downloads over the chosen adapter, but the game itself (`VALORANT-Win64-Shipping.exe`) will continue using default routing unless explicitly assigned as well. NetSplit supports grouping these executables under a single unified application profile.
- **Example 2: Steam & Steam Games**
  - Steam Client: `steam.exe`
  - Web Helper: `steamwebhelper.exe`
  - Game Binaries: e.g. `dota2.exe`, `cs2.exe`
  - *Limitation & Guidance:* Child processes spawned by Steam do not automatically inherit Steam's socket binding unless their specific executable paths are registered in NetSplit rules.

### 3.2 Raw Sockets & ICMP Ping
- Windows security policy (since Windows XP SP2) prohibits unprivileged user-mode applications from creating raw sockets (`SOCK_RAW`) for custom IP header generation.
- Traditional ICMP `ping` packets issued by `ping.exe` use the Windows IP Helper ICMP API (`IcmpSendEcho`), which relies on the Windows kernel's global routing table.
- In-game latency meters that rely on UDP/TCP connection round-trip times reflect the bound adapter's true latency, whereas command-line `ping.exe` might show the default route's ping unless explicitly directed with `ping -S <source_ip>`.

### 3.3 VPN & Virtual Tunnel Adapters (WireGuard, OpenVPN, Cisco AnyConnect)
- **Full Tunnel VPNs:** When a VPN client configures a default route with metric 1 (`0.0.0.0/0 via VPN_GATEWAY`) and enables strict WFP firewall block rules on all physical interfaces (common in "VPN Kill-Switch" implementations), outbound packets bound to physical adapters (such as physical Wi-Fi or Ethernet) may be dropped by the VPN's WFP filter.
- **Split Tunnel VPNs:** Fully compatible with NetSplit. Applications assigned to physical Ethernet or Wi-Fi bypass the VPN tunnel, while unassigned applications follow the VPN gateway.

### 3.4 Hyper-V, WSL2, and Virtual Switch Adapters
- Virtual Ethernet adapters created by Hyper-V or Windows Subsystem for Linux (WSL2) create internal NAT virtual switches.
- Applications running inside a WSL2 Linux virtual machine egress through the virtual switch NAT gateway before hitting the Windows host stack. NetSplit can route the WSL host process (`wsl.exe`, `vmmem.exe`), but individual Linux processes inside the VM share the single virtual interface.

### 3.5 Inbound Listening Sockets (Peer-to-Peer & Server Hosting)
- NetSplit is designed for **outbound egress routing**.
- If an application acts as an incoming server listening on `0.0.0.0:<port>` (e.g. hosting a game server or torrent listening port), incoming connections depend on your router's NAT port forwarding directed to the specific adapter's local IP address.
