# 多功能影片處理工具

這個 repository 提供 SkillGodAK 的 Windows 多功能影片處理工具公開 EXE，以及程式自動更新使用的 `version.json`。

## 最新版本

- 版本：`20260717-4`
- 檔案：`多功能影片處理工具20260717-4.exe`
- Release：[v20260717-4](https://github.com/SkillGodAk/multi-function-video-tool/releases/tag/v20260717-4)
- 下載：[20260717-4.exe](https://github.com/SkillGodAk/multi-function-video-tool/releases/download/v20260717-4/20260717-4.exe)

## 20260717-4 更新內容

- 修正 `20260717-3` 打包缺少 `tkinter`，造成程式啟動失敗。
- Tcl/Tk 路徑改由打包規格自動設定，避免之後再次漏包。
- 保留自動更新重啟修正，不再沿用已清除的舊 `_MEI` 目錄。
- 保留更新下載即時進度、手動檢查更新、季數自動判斷與重命名報告。

> `20260717-3` 已停用，請直接下載 `20260717-4`。

## 自動更新資料

程式會讀取：

```text
https://raw.githubusercontent.com/SkillGodAk/multi-function-video-tool/master/version.json
```

當 `version` 高於目前版本時，程式會提示是否下載並安裝更新。
