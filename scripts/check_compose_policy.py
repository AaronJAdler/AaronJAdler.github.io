"""Policy-as-code for the compose files players run (doc 05, Gatekeeper).

Players run our compose file with Docker, which is effectively root on their
machine. This check fails the build if a change would weaken the sandbox:
privileged mode, host namespaces, added capabilities, host-path mounts,
devices, ports reachable beyond loopback, images from anywhere but our GHCR
namespace, or a vulnerable target with a route off its internal network.

It guards against mistakes and unreviewed edits. It cannot stop someone who
already has push access (they could edit this file too), which is why branch
protection and 2FA matter.

    python scripts/check_compose_policy.py play/docker-compose.yml
    python scripts/check_compose_policy.py --dev local/docker-compose.yml
"""
from __future__ import annotations

import sys

import yaml

IMAGE_PREFIX = "ghcr.io/aaronjadler/cyberguard-"
FORBIDDEN_KEYS = {"privileged", "network_mode", "pid", "ipc", "uts", "userns_mode",
                  "cap_add", "devices", "device_cgroup_rules", "sysctls", "cgroup_parent",
                  "extra_hosts", "volumes_from", "user"}
VULNERABLE = {"target"}  # services that must stay on internal-only networks


def _port_ok(port) -> bool:
    if isinstance(port, dict):
        return port.get("host_ip") == "127.0.0.1"
    return str(port).startswith("127.0.0.1:")


def _volume_source(vol) -> str:
    if isinstance(vol, dict):
        return "bind" if vol.get("type") == "bind" else str(vol.get("source", ""))
    return str(vol).split(":", 1)[0]


def check(doc: dict, *, require_images: bool) -> list[str]:
    errors: list[str] = []
    networks = doc.get("networks") or {}
    named_volumes = set((doc.get("volumes") or {}).keys())
    services = doc.get("services") or {}
    if not services:
        return ["no services defined"]
    for name, svc in services.items():
        where = f"service {name!r}"
        for key in FORBIDDEN_KEYS & set(svc):
            errors.append(f"{where}: '{key}' is not allowed")
        if svc.get("read_only") is not True:
            errors.append(f"{where}: read_only must be true")
        if "ALL" not in (svc.get("cap_drop") or []):
            errors.append(f"{where}: cap_drop must include ALL")
        if "no-new-privileges:true" not in (svc.get("security_opt") or []):
            errors.append(f"{where}: security_opt must include no-new-privileges:true")
        for limit in ("pids_limit", "mem_limit"):
            if limit not in svc:
                errors.append(f"{where}: {limit} is required")
        for port in svc.get("ports") or []:
            if not _port_ok(port):
                errors.append(f"{where}: port {port!r} must be bound to 127.0.0.1")
        for vol in svc.get("volumes") or []:
            src = _volume_source(vol)
            if src not in named_volumes:
                errors.append(f"{where}: volume {vol!r} must be a named volume (no host paths)")
        if require_images:
            image = str(svc.get("image", ""))
            if not image.startswith(IMAGE_PREFIX):
                errors.append(f"{where}: image must come from {IMAGE_PREFIX}*")
            if "build" in svc:
                errors.append(f"{where}: player compose must not build from source")
        svc_nets = svc.get("networks") or ["default"]
        svc_nets = list(svc_nets.keys()) if isinstance(svc_nets, dict) else svc_nets
        if name in VULNERABLE:
            if svc.get("ports"):
                errors.append(f"{where}: the vulnerable target must not publish ports")
            for net in svc_nets:
                if not (networks.get(net) or {}).get("internal"):
                    errors.append(f"{where}: network {net!r} must be internal: true")
    return errors


def main(argv: list[str]) -> int:
    # Dev compose builds from source; player compose (the default) must use our images.
    dev = "--dev" in argv
    paths = [a for a in argv if a != "--dev"] or ["play/docker-compose.yml"]
    failed = False
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
        errors = check(doc, require_images=not dev)
        for e in errors:
            print(f"{path}: {e}")
        failed |= bool(errors)
        if not errors:
            print(f"{path}: ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
