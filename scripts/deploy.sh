#!/bin/bash
set -x

# sh ./scripts/deploy.sh slotssaga-resource

SERVER=$1
if [[ $SERVER == "" ]]; then
    echo "SERVER is null"
    exit
fi

TARGET_DIR="/home/ec2-user/slots-resource-sync";

# 创建目录
`ssh $SERVER mkdir -p $TARGET_DIR`

# 复制上传
EXCLUDE="--exclude=.git --exclude=.vscode --exclude=node_modules --exclude=data --exclude=logs"
rsync -va --progress --delete ${EXCLUDE} ./ ${SERVER}:${TARGET_DIR}