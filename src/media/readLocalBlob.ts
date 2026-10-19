/** Read picker/recorder URIs without depending on Expo's global fetch backend. */
export function readLocalBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if ((xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) && xhr.response) {
        resolve(xhr.response as Blob);
      } else {
        reject(new Error("無法讀取媒體檔案"));
      }
    };
    xhr.onerror = () => reject(new Error("讀取媒體檔案失敗"));
    xhr.onabort = () => reject(new Error("已取消讀取媒體檔案"));
    xhr.ontimeout = () => reject(new Error("讀取媒體檔案逾時"));
    xhr.open("GET", uri, true);
    xhr.responseType = "blob";
    xhr.timeout = 30000;
    xhr.send(null);
  });
}
