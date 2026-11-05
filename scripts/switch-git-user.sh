#!/usr/bin/env bash
case "$1" in
  likith)
    git config user.name "Likith Kumar K M"
    git config user.email "kmlikithkumar@gmail.com"
    echo "Git local identity set to: Likith Kumar K M <kmlikithkumar@gmail.com>"
    ;;
  madan)
    git config user.name "Madan P"
    git config user.email "madanmadan1020@gmail.com"
    echo "Git local identity set to: Madan P <madanmadan1020@gmail.com>"
    ;;
  *)
    echo "Usage: ./scripts/switch-git-user.sh [likith|madan]"
    exit 1
    ;;
esac
