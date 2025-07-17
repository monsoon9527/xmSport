import axios, { AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { toQueryString } from './utils';
import { 
  LoginResponse, 
  AppTokenResponse, 
  ApiResponse, 
  LoginTokenAndUserIdResult
} from './types';

// 声明axios-retry模块
declare module 'axios-retry';

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 初始延迟时间（毫秒）
const RETRY_MULTIPLIER = 1.5; // 延迟时间乘数

/**
 * 通用重试函数 - 为任何异步操作添加重试逻辑
 * @param {Function} asyncFn - 异步函数
 * @param {any[]} args - 函数参数
 * @param {string} operationName - 操作名称（用于日志）
 * @param {number} maxRetries - 最大重试次数
 * @param {number} initialDelay - 初始延迟时间（毫秒）
 * @param {number} multiplier - 延迟时间乘数
 * @returns {Promise<T>} 函数结果
 */
async function withRetry<T>(
  asyncFn: (...args: any[]) => Promise<T>, 
  args: any[] = [], 
  operationName: string = '请求操作',
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = RETRY_DELAY,
  multiplier: number = RETRY_MULTIPLIER
): Promise<T> {
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      return await asyncFn(...args);
    } catch (error: any) {
      retries++;
      
      // 检查是否达到最大重试次数
      if (retries >= maxRetries) {
        console.error(`${operationName}失败，已达到最大重试次数(${maxRetries}次)`);
        throw error;
      }
      
      // 计算延迟时间
      delay = Math.floor(delay * multiplier);
      
      console.log(`${operationName}失败，${retries}秒后重试(${retries}/${maxRetries})...`);
      
      // 输出错误信息
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应数据: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error('无响应');
      } else {
        console.error(`错误: ${error.message}`);
      }
      
      // 等待延迟时间
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * 执行Axios请求
 * @param {AxiosRequestConfig} config - Axios配置
 * @returns {Promise<T>} 请求响应数据
 */
async function executeRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await axios(config);
  return response.data;
}

/**
 * 获取登录Code
 * @param {string} phoneNumber - 手机号
 * @param {string} password - 密码
 * @returns {Promise<string>} 登录Code
 */
export async function getCode(phoneNumber: string, password: string): Promise<string> {
  try {
    const getLoginCode = async (): Promise<string> => {
      // 构造请求配置
      const url = `https://api-user.huami.com/registrations/${phoneNumber}/tokens`;
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 5.1.1; SM-G9750 Build/LMY48Z)'

      };
      const data = {
	phone_number: phoneNumber, 
        client_id: 'HuaMi',
        password: password,
        redirect_uri: 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
        token: 'access'
      };
      
      const response = await axios.post(url, toQueryString(data), {
        headers: headers,
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });
      
      const location = response.headers.location;
      
      if (!location) {
        throw new Error('无法获取重定向地址');
      }
      
      const codeMatch = /(?<=access=).*?(?=&)/.exec(location);
      
      if (!codeMatch || !codeMatch[0]) {
        throw new Error('无法从重定向地址中提取code');
      }
      
      return codeMatch[0];
    };
    
    // 使用withRetry执行请求
    const code = await withRetry(getLoginCode, [], '获取登录Code');
    console.log('🔐 获取Code成功');
    return code;
  } catch (error: any) {
    console.error(`获取登录Code出错: ${error.message}`);
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error(`响应数据: ${JSON.stringify(error.response.data)}`);
    }
    return '';
  }
}

/**
 * 获取登录Token和用户ID
 * @param {string} code - 登录Code
 * @returns {Promise<LoginTokenAndUserIdResult>} 登录Token和用户ID
 */
export async function getLoginTokenAndUserId(code: string, phoneNumber: string): Promise<LoginTokenAndUserIdResult> {
  const getTokenAndUserId = async (): Promise<LoginTokenAndUserIdResult> => {
    const url = 'https://account.huami.com/v2/client/login';
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.0.1; Scale/2.00)'
    };
    // 1) 判断登录类型
    const third_name = phoneNumber.startsWith('+86') ? 'huami_phone' : 'email';
    // 2) 原有 data 对象里加入所有 Python 版也有的字段：
    const data: Record<string, string> = {
      allow_registration: 'false',
      app_name: 'com.xiaomi.hm.health',
      app_version:   '6.3.5',
      code: code,
      country_code: 'CN',
      device_id: '2C8B4939-0CCD-4E94-8CBA-CB8EA6E613A1',
      device_model: 'phone',
      dn: 'api-user.huami.com%2Capi-mifit.huami.com%2Capp-analytics.huami.com',
      grant_type: 'access_token',
      lang: 'zh_CN',
      os_version: '1.5.0',
      source: 'com.xiaomi.hm.health',
      third_name
    };
    // 3) 如果是邮箱登录（third_name === 'email'），再加上 passport：
    if (third_name === 'email') {
    data.passport = phoneNumber;
    }
    const response = await axios.post<LoginResponse>(url, toQueryString(data), {
      headers: headers
    });
    
    if (!response.data.token_info || !response.data.token_info.login_token || !response.data.token_info.user_id) {
      throw new Error('响应数据中缺少必要的token_info字段');
    }
    
    const loginToken = response.data.token_info.login_token;
    const userId = response.data.token_info.user_id;
    
    return { loginToken, userId };
  };
  
  // 使用withRetry执行请求
  const result = await withRetry(getTokenAndUserId, [], '获取登录Token和用户ID');
  console.log('🔐 获取LoginToken和UserId成功');
  return result;
}

/**
 * 获取App Token
 * @param {string} loginToken - 登录Token
 * @returns {Promise<string>} App Token
 */
export async function getAppToken(loginToken: string): Promise<string> {
  const fetchAppToken = async (): Promise<string> => {
    const url = `https://account-cn.huami.com/v1/client/app_tokens?app_name=com.xiaomi.hm.health&dn=api-user.huami.com,api-mifit.huami.com,app-analytics.huami.com&login_token=${loginToken}`;
    const headers = {
      'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.0.1; Scale/2.00)'
    };
    
    const response = await axios.get<AppTokenResponse>(url, {
      headers: headers
    });
    
    if (!response.data.token_info || !response.data.token_info.app_token) {
      throw new Error('响应数据中缺少必要的app_token字段');
    }
    
    return response.data.token_info.app_token;
  };
  
  // 使用withRetry执行请求
  const appToken = await withRetry(fetchAppToken, [], '获取AppToken');
  console.log('🔐 获取AppToken成功');
  return appToken;
}

/**
 * 发送数据到API
 * @param userId 用户ID
 * @param appToken APP令牌
 * @param dataJson 数据JSON
 * @returns API响应
 */
export async function sendData(userId: string, appToken: string, dataJson: string): Promise<ApiResponse> {
  const sendDataRequest = async (): Promise<ApiResponse> => {
    const url = `https://api-mifit-cn2.huami.com/v1/data/band_data.json`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'apptoken': appToken
    };

    const data = {
      userid: userId,
      last_sync_data_time: '1597306380',
      device_type: '0',
      last_deviceid: 'DA932FFFFE8816E7',
      data_json: dataJson
    };

    const config: AxiosRequestConfig = {
      method: 'post',
      url: url,
      headers: headers,
      data: toQueryString(data)
    };

    const response = await executeRequest<ApiResponse>(config);

    // 如果响应中包含message字段，则认为发送成功
    if (response && typeof response.message !== 'undefined') {
      console.log(`成功发送数据: ${response.message}`);
      return response;
    } else {
      console.error('发送数据返回未知响应: ', response);
      throw new Error('发送数据返回未知响应');
    }
  };

  // 使用withRetry执行请求
  return await withRetry(sendDataRequest, [], '发送数据');
} 