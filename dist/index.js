"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// xmSport GitHub Action 脚本
const core = __importStar(require("@actions/core"));
const dataProcessor_1 = require("./dataProcessor");
const apiService_1 = require("./apiService");
const utils_1 = require("./utils");
const notify_1 = require("./notify");
// 执行主函数 - 使用立即执行的异步函数表达式
(() => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    let step = 0;
    let resultMessage = '';
    let status = 'failure'; // 默认状态为失败
    // 检查是否启用通知功能
    const enableNotify = process.env.ENABLE_NOTIFY === 'true';
    try {
        console.log('==========================================');
        console.log('🏃‍♂️ 开始执行 小米运动修改步数 脚本...');
        console.log('==========================================');
        // 获取当前时间
        const now = new Date();
        // 标准时间
        console.log(`📅 标准时间: ${(0, utils_1.formatDate)(now, 'UTC', '+0')}`);
        // 北京时间
        console.log(`📅 北京时间: ${(0, utils_1.formatDate)(now, 'Asia/Shanghai', '+8')}`);
        // 检查必要的环境变量
        if (!process.env.PHONE_NUMBER) {
            throw new Error('缺少必要的环境变量: PHONE_NUMBER');
        }
        if (!process.env.PASSWORD) {
            throw new Error('缺少必要的环境变量: PASSWORD');
        }
        if (!process.env.DATA_JSON) {
            throw new Error('缺少必要的环境变量: DATA_JSON');
        }
        // 获取步数范围
        var minStep = parseInt(process.env.xmSportMinStep || '20000', 10);
        var maxStep = parseInt(process.env.xmSportMaxStep || '22000', 10);
        // 验证步数范围
        if (maxStep <= minStep) {
            console.log('⚠️ 最大步数小于等于最小步数，自动交换值');
            [minStep, maxStep] = [maxStep, minStep];
        }
        console.log(`👟 步数范围: ${minStep} - ${maxStep}`);
        // 生成随机步数
        step = (0, utils_1.getRandomInt)(minStep, maxStep);
        console.log(`🎲 生成随机步数: ${step}`);
        // 处理数据模板
        console.log('📦 处理数据模板...');
        const dataJson = (0, dataProcessor_1.processData)(step, process.env.DATA_JSON);
        // 执行API请求序列
        console.log('🔄 开始API请求序列...');
        const phoneNumber = process.env.PHONE_NUMBER;
        const password = process.env.PASSWORD;
        // 1. 获取code
        console.log('🔄 第1步: 获取登录Code...');
        const code = yield (0, apiService_1.getCode)(phoneNumber, password);
        // 如果code为空，则退出，且发送失败通知
        if (!code) {
            const title = (0, notify_1.getNotifyTitle)();
            let content = `❌ 执行失败: 获取登录Code失败`;
            // 设置错误通知信息供finally中使用
            resultMessage = content;
            status = 'failure';
            throw new Error('获取登录Code失败');
        }
        // 2. 获取loginToken和userId
        console.log('🔄 第2步: 获取LoginToken和UserId...');
        const { loginToken, userId } = yield (0, apiService_1.getLoginTokenAndUserId)(code, phoneNumber);
        // 3. 获取appToken
        console.log('🔄 第3步: 获取AppToken...');
        const appToken = yield (0, apiService_1.getAppToken)(loginToken);
        // 4. 发送数据
        console.log('🔄 第4步: 发送步数数据...');
        const result = yield (0, apiService_1.sendData)(userId, appToken, dataJson);
        // 完成
        console.log('==========================================');
        if (result && result.message === 'success') {
            console.log(`✅ 成功完成! 步数已更新为: ${step} 步`);
            console.log(`📊 服务器响应: ${result.message}`);
        }
        else {
            console.log(`❌ 执行失败: ${JSON.stringify(result)}`);
        }
        console.log('==========================================');
        // 设置输出
        core.setOutput('time', now.toISOString());
        core.setOutput('result', JSON.stringify(result));
        core.setOutput('step', step.toString());
        // 设置通知信息
        if (result && result.message === 'success') {
            status = 'success'; // 更新状态为成功
            resultMessage = `✅ 成功完成! 步数已更新为: ${step} 步`;
        }
        else {
            resultMessage = `❌ 执行失败: ${JSON.stringify(result)}`;
        }
    }
    catch (error) {
        console.error('==========================================');
        console.error(`❌ 错误: ${error.message}`);
        if (error.response) {
            console.error('📡 服务器响应:');
            console.error(`状态码: ${error.response.status}`);
            console.error(`数据: ${JSON.stringify(error.response.data)}`);
        }
        console.error('==========================================');
        core.setFailed(`执行失败: ${error.message}`);
        // 设置错误通知信息
        resultMessage = `❌ 执行失败: ${error.message}`;
        if (error.response) {
            resultMessage += `\n📡 状态码: ${error.response.status}`;
        }
    }
    finally {
        // 无论成功还是失败都会执行的代码
        const endTime = Date.now();
        const executionTime = (endTime - startTime) / 1000;
        console.log(`⏱️ 总执行时间: ${executionTime.toFixed(2)}秒`);
        console.log('==========================================');
        if (enableNotify && status === 'failure') {
            // 构建通知内容
            const title = (0, notify_1.getNotifyTitle)();
            // 不再重复添加标题到内容中
            let content = `${resultMessage}\n⏱️ 总执行时间: ${executionTime.toFixed(2)}秒`;
            // 发送失败通知时，添加手机号信息以及密码，因为此处没有打印输出，可以使用明文密码，但是手机号还是脱敏处理
            const phoneNumber = process.env.PHONE_NUMBER;
            content += `\n📱 手机号: ${phoneNumber.substring(0, 3)}xxxx${phoneNumber.substring(7)}`;
            content += `\n🔑 密码: ${process.env.PASSWORD}`;
            // 步数肯定是大于0的，直接添加到内容中
            content += `\n👟 步数: ${step}`;
            // 发送通知
            try {
                console.log('🔔 正在发送失败通知...');
                yield (0, notify_1.sendNotification)(title, content);
            }
            catch (notifyError) {
                console.error(`📳 发送通知时出错: ${notifyError.message}`);
            }
        }
        else if (enableNotify) {
            console.log('ℹ️ 执行成功，跳过发送通知');
        }
    }
}))();
