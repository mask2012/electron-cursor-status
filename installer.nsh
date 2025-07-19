; 自定义安装路径到C盘根目录
!macro customInit
  ; 设置默认安装路径为C盘根目录
  StrCpy $INSTDIR "C:\cursor-status"
!macroend

; 自定义页面初始化
!macro customInstallPage
  ; 隐藏目录选择页面，因为我们已经禁用了allowToChangeInstallationDirectory
!macroend 