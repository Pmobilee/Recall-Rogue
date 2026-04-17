# Windows VM — Quick SSH Setup

Fresh Windows 11 x64 install in UTM (bridged mode). Three steps to get Claude SSH access.

## Step 1: Enable SSH on the VM

From the VM console, open PowerShell as Admin and run:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

## Step 2: Find the VM IP

From the Mac terminal:

```bash
for ip in $(arp -a | grep '192.168.11' | grep -oE '192\.168\.11\.[0-9]+' | grep -v '\.255$' | grep -v '\.1$'); do
  result=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes damion@$ip "hostname" 2>/dev/null)
  if [ $? -eq 0 ]; then echo "FOUND: $ip ($result)"; break; fi
done
```

## Step 3: Push SSH Key

Replace `<IP>` with the IP found above:

```bash
sshpass -p 'chrx' ssh damion@<IP> "powershell -Command \"Set-Content -Path 'C:\ProgramData\ssh\administrators_authorized_keys' -Value 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEH21agjJ+Rb9aCzEWOiXTSJj0C0QgVBvVr3yFan3muO mulda@IntelliDows'; icacls 'C:\ProgramData\ssh\administrators_authorized_keys' /inheritance:r /grant 'SYSTEM:(F)' /grant 'Administrators:(F)'; Restart-Service sshd\""
```

## Verify

```bash
ssh damion@<IP> "echo connected && hostname"
```

Shared folder (`Z:\`) is the same UTM VirtioFS mount as before.
