# 剪映草稿槽位替换可行性分析报告

> 诊断日期：2026/06/08
> 测试草稿：MIXCUT_EMPTY_TEMPLATE
> 分析目标：判断能否通过替换外部文件实现视频内容替换

---

## 1. 搜索结果：1.mp4 / 7.mp4 引用路径

### 1.1 在所有明文 JSON 文件中搜索

| 文件 | 1.mp4 引用 | 7.mp4 引用 | 路径字段 |
|------|-----------|-----------|---------|
| `draft_settings` | 无 | 无 | 无 |
| `key_value.json` | **有**（materialName = "1.mp4"） | **有**（materialName = "7.mp4"） | `path = ""`（空） |
| `timeline_layout.json` | 无 | 无 | 无 |
| `draft_virtual_store.json` | 无 | 无 | 无 |
| `draft_agency_config.json` | 无 | 无 | 无 |
| `project.json` | 无 | 无 | 无 |
| `root_meta_info.json` | 无 | 无 | 无 |

### 1.2 key_value.json 详情

```json
{
  "0B2BCD0B-8514-4252-BE68-F61823AF2A6F": {
    "materialId": "6ccabdce262d1e8d13f0e6124c514aec",
    "materialName": "1.mp4",
    "path": ""           ← 空字符串，不是文件路径
  },
  "588c71d3520b69727910f890ff6be2a9": {
    "materialId": "588c71d3520b69727910f890ff6be2a9",
    "materialName": "7.mp4",
    "path": ""           ← 空字符串，不是文件路径
  },
  "6ccabdce262d1e8d13f0e6124c514aec": {
    "materialId": "6ccabdce262d1e8d13f0e6124c514aec",
    "materialName": "1.mp4",
    "path": ""           ← 空字符串，不是文件路径
  }
}
```

### 1.3 在 base64 opaque 二进制文件中搜索

**draft_content.json（base64 解码后）：**
- 解码后大小：**4690 字节**（二进制）
- 熵值：**7.959 / 8.0**（接近随机/加密数据）
- `.mp4` 字符串出现次数：**0**
- `1.mp4` 字符串出现次数：**0**
- `7.mp4` 字符串出现次数：**0**
- Windows 路径模式出现次数：**0**
- `assets` 字符串出现次数：**0**

**draft_meta_info.json（base64 解码后）：**
- 解码后大小：**约 2981 字节**（二进制）
- 熵值：同样接近随机
- 无任何可读的视频文件路径

### 1.4 结论：视频引用方式

**1.mp4 和 7.mp4 不是外部文件路径引用。**

- 所有 JSON 配置文件中 `path` 字段均为空字符串 `""`
- 二进制 opaque 文件中不包含明文文件路径
-视频内容以内嵌二进制数据形式存在于剪映的内部材料存储中

---

## 2. 草稿内部材料大小分析

从 `root_meta_info.json` 获取：

| 字段 | 值 | 说明 |
|------|-----|------|
| `tm_duration` | 6800000 µs = **6.8 秒** | 草稿总时长 |
| `draft_timeline_materials_size` | **2771409 字节 ≈ 2.77 MB** | 时间线材料总大小 |
| `draft_cover.jpg` | **295617 字节 ≈ 288 KB** | 封面图片 |

2.77 MB 的 `draft_timeline_materials_size` 对应 6.8 秒草稿，说明视频材料是以某种形式内嵌存储的（可能是压缩二进制）。

---

## 3. 槽位替换路线可行性判断

### 结论：不可行（针对 MIXCUT_EMPTY_TEMPLATE 类型草稿）

**原因：**

1. **视频无外部文件路径** — `path` 字段全部为空字符串，剪映不通过文件系统路径引用这些视频

2. **视频内容内嵌在 opaque 二进制中** — `draft_content.json` 的解码二进制内容高度随机（熵 7.959/8.0），说明视频数据以压缩/加密二进制格式存储在其中

3. **剪映使用内部材料存储** — 2.77 MB 的 `draft_timeline_materials_size` 不对应任何可见文件，说明剪映将视频材料存储在应用程序私有数据区，不在草稿目录中

4. **`template.tmp` 是空白模板** — `Timelines/<id>/template.tmp` 的 `duration = 0`，不含任何 tracks/materials，不是实际时间线数据载体

5. **同名文件覆盖不可行** — 没有外部 `.mp4` 文件可以被"同名替换"，因为根本不存在引用这些文件的路径

---

## 4. MIXCUT_TEST_SLOT_REPLACE 生成情况

**未生成。**

原因：没有找到任何可以通过外部文件替换来修改视频内容的可行路径。生成一个空操作的"槽位替换测试"草稿没有意义。

如果用户坚持尝试，可以：
- 将 `draft_content.json` 的 base64 内容理解为"材料数据容器"
- 如果在剪映内部数据库中找到对应记录，可以通过剪映的材料管理界面替换
- 但这超出了纯文件系统操作的范畴

---

## 5. 下一步建议

### 方案 A：换一种草稿类型
在剪映中创建一个**外部引用型草稿**（导入本地视频文件而非内嵌），这样的草稿会在 `materials.videos[].path` 中存储真实的文件系统路径，从而支持"替换路径指向的文件"策略。

### 方案 B：研究剪映导入接口
使用剪映官方的草稿导入功能（而非直接写文件），通过剪映 GUI 将外部视频导入草稿，这会正确设置路径引用。

### 方案 C：接受内嵌草稿限制
MIXCUT_EMPTY_TEMPLATE 类型的草稿不支持文件级别的视频替换，必须通过剪映 GUI本身来修改视频内容。

---

## 附录：各文件搜索汇总

| 文件 | 格式 | 1.mp4 引用 | 7.mp4 引用 | 文件路径 |
|------|------|-----------|-----------|---------|
| draft_settings | INI文本 | 无 | 无 | 不适用 |
| key_value.json | JSON | materialName="1.mp4" | materialName="7.mp4" | path=""（空） |
| timeline_layout.json | JSON | 无 | 无 | 不适用 |
| draft_virtual_store.json | JSON | 无 | 无 | 不适用 |
| draft_agency_config.json | JSON | 无 | 无 | 不适用 |
| root_meta_info.json | JSON | 无 | 无 | 不适用 |
| draft_content.json | base64二进制 | 无 | 无 | 不适用 |
| draft_meta_info.json | base64二进制 | 无 | 无 | 不适用 |
| Timelines/project.json | JSON | 无 | 无 | 不适用 |
| Timelines/template.tmp | JSON | 无 | 无 | 不适用 |
| Timelines/.../draft_content.json | base64二进制 | 无 | 无 | 不适用 |