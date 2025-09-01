"use strict";
/**
 * 处理步数数据的模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processData = processData;
/**
 * 处理步数数据
 * @param {number} step - 要设置的步数
 * @param {string} [jsonTemplate] - 可选的JSON模板字符串
 * @returns {string} 处理后的数据JSON字符串
 */
function processData(step, jsonTemplate) {
    // 步数值校验
    if (typeof step !== 'number' || isNaN(step) || step <= 0) {
        throw new Error('❌ 步数必须是大于0的有效数字');
    }
    // 如果没有提供模板，但环境变量中有DATA_JSON，则使用环境变量
    if (!jsonTemplate && process.env.DATA_JSON) {
        const envTemplate = process.env.DATA_JSON.trim();
        if (!envTemplate) {
            throw new Error('❌ DATA_JSON环境变量为空');
        }
        return processExistingTemplate(step, envTemplate);
    }
    // 如果提供了模板，则处理现有模板
    if (jsonTemplate) {
        if (typeof jsonTemplate !== 'string' || !jsonTemplate.trim()) {
            throw new Error('❌ 提供的JSON模板无效');
        }
        return processExistingTemplate(step, jsonTemplate);
    }
    // 否则抛出错误
    throw new Error('❌ 缺少数据模板，请提供jsonTemplate参数或设置DATA_JSON环境变量');
}
/**
 * 处理现有模板
 * @param {number} step - 要设置的步数
 * @param {string} jsonTemplate - JSON模板字符串
 * @returns {string} 处理后的数据JSON字符串
 */
function processExistingTemplate(step, jsonTemplate) {
    var _a, _b, _c;
    // 计算距离/卡路里（成年女性近似）
    const distanceMeters = Math.round(step * 0.73); // 米
    const caloriesKcal = Math.round(step * 0.04); // 千卡
    // 获取当前日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    // 尝试用“解码 + 解析 JSON”的方式改写（更稳）
    try {
        const decoded = decodeURIComponent(jsonTemplate);
        // 模板有的就是数组，有的是单对象；统一成数组处理
        const arr = JSON.parse(decoded.startsWith('[') ? decoded : `[${decoded}]`);
        const item = (_a = arr[0]) !== null && _a !== void 0 ? _a : {};
        // 更新 date
        item.date = currentDate;
        // summary 可能是字符串（JSON 字符串）或对象，这里统一解析为对象
        let summaryObj = typeof item.summary === 'string' ? JSON.parse(item.summary) :
            ((_b = item.summary) !== null && _b !== void 0 ? _b : {});
        summaryObj.stp = (_c = summaryObj.stp) !== null && _c !== void 0 ? _c : {};
        summaryObj.stp.ttl = step; // 步数
        summaryObj.stp.dis = distanceMeters; // 距离（米）
        summaryObj.stp.cal = caloriesKcal; // 卡路里（kcal）
        // 回写 summary 为字符串（保持原结构）
        item.summary = JSON.stringify(summaryObj);
        // 重新编码返回
        const encoded = encodeURIComponent(JSON.stringify(arr));
        console.log(`📅 日期已更新: ${currentDate}`);
        console.log(`👣 步数已更新: ${step}`);
        console.log(`📏 距离已更新: ${distanceMeters} m`);
        console.log(`🔥 卡路里已更新: ${caloriesKcal} kcal`);
        return encoded;
    }
    catch (e) {
        // 解析失败时，回退到“正则替换”方案，并新增 dis/cal 的替换
        try {
            // 尝试使用正则表达式匹配
            const finddate = /.*?date%22%3A%22(.*?)%22%2C%22data.*?/;
            const findstep = /.*?ttl%5C%22%3A(.*?)%2C%5C%22dis.*?/;
            const reDIS = /%5C%22dis%5C%22%3A(\d+)/;
            const reCAL = /%5C%22cal%5C%22%3A(\d+)/;
            let processedData = jsonTemplate;
            // 替换日期
            const dateMatch = finddate.exec(processedData);
            if (dateMatch && dateMatch[1]) {
                processedData = processedData.replace(dateMatch[1], currentDate);
                // 判断是否修改成功
                const checkDateMatch = finddate.exec(processedData);
                if (checkDateMatch && checkDateMatch[1] === currentDate) {
                    console.log(`📅 日期已更新: ${currentDate}`);
                }
                else {
                    console.warn('⚠️ 日期更新失败，请检查模板格式');
                }
            }
            else {
                console.warn('⚠️ 无法找到日期字段，跳过日期更新');
            }
            // 替换步数
            const stepMatch = findstep.exec(processedData);
            if (stepMatch && stepMatch[1]) {
                processedData = processedData.replace(stepMatch[1], String(step));
                // 判断是否修改成功
                const checkStepMatch = findstep.exec(processedData);
                if (checkStepMatch && checkStepMatch[1] === String(step)) {
                    console.log(`👣 步数已更新: ${step}`);
                }
                else {
                    console.warn('⚠️ 步数更新失败，请检查模板格式');
                }
            }
            else {
                console.warn('⚠️ 无法找到步数字段，跳过步数更新');
            }
            // 距离
            if (reDIS.test(processedData)) {
                processedData = processedData.replace(reDIS, (m, g1) => m.replace(g1, String(distanceMeters)));
                console.log(`📏 距离已更新: ${distanceMeters} m`);
            }
            else {
                console.warn('⚠️ 无法找到距离字段，跳过距离更新（正则回退）');
            }
            // 卡路里
            if (reCAL.test(processedData)) {
                processedData = processedData.replace(reCAL, (m, g1) => m.replace(g1, String(caloriesKcal)));
                console.log(`🔥 卡路里已更新: ${caloriesKcal} kcal`);
            }
            else {
                console.warn('⚠️ 无法找到卡路里字段，跳过卡路里更新（正则回退）');
            }
            // 验证是否包含必要字段
            if (!processedData.includes('data_json') || !processedData.includes('ttl')) {
                console.warn('⚠️ 处理后的数据中可能缺少必要字段，请检查模板格式');
            }
            return processedData;
        }
        catch (error) {
            throw new Error(`❌ 处理模板时出错: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
