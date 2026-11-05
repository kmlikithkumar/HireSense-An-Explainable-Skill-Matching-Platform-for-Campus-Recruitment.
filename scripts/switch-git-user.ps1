param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("likith", "madan")]
  [string]$User
)

if ($User -eq "likith") {
  git config user.name "Likith Kumar K M"
  git config user.email "kmlikithkumar@gmail.com"
  Write-Host "Git local identity set to: Likith Kumar K M <kmlikithkumar@gmail.com>" -ForegroundColor Green
} elseif ($User -eq "madan") {
  git config user.name "Madan P"
  git config user.email "madanmadan1020@gmail.com"
  Write-Host "Git local identity set to: Madan P <madanmadan1020@gmail.com>" -ForegroundColor Green
}
