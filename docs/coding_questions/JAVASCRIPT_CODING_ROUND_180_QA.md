# JavaScript Coding Round: 180 Questions and Answers

## Audience
- Interview preparation for JavaScript coding rounds
- Covers fundamentals, data structures, algorithms, async, and JS utilities
- Each question includes a reference answer and complexity

---

## Basics & Math

### Q1. Implement FizzBuzz in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function fizzBuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    let s = '';
    if (i % 3 === 0) s += 'Fizz';
    if (i % 5 === 0) s += 'Buzz';
    out.push(s || String(i));
  }
  return out;
}
```

### Q2. Implement FizzBuzz and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: n <= 0 should return an empty array.
- Reference complexity: Time O(n), Space O(n)

```javascript
function fizzBuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    let s = '';
    if (i % 3 === 0) s += 'Fizz';
    if (i % 5 === 0) s += 'Buzz';
    out.push(s || String(i));
  }
  return out;
}
```

### Q3. Solve FizzBuzz with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function fizzBuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    let s = '';
    if (i % 3 === 0) s += 'Fizz';
    if (i % 5 === 0) s += 'Buzz';
    out.push(s || String(i));
  }
  return out;
}
```

### Q4. Implement Check Prime Number in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(sqrt(n)), Space O(1)

```javascript
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}
```

### Q5. Implement Check Prime Number and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle n < 2 and even numbers efficiently.
- Reference complexity: Time O(sqrt(n)), Space O(1)

```javascript
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}
```

### Q6. Solve Check Prime Number with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(sqrt(n)), Space O(1)

```javascript
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}
```

### Q7. Implement Greatest Common Divisor (Euclid) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(log(min(a,b))), Space O(1)

```javascript
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
```

### Q8. Implement Greatest Common Divisor (Euclid) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support zero inputs and negative numbers.
- Reference complexity: Time O(log(min(a,b))), Space O(1)

```javascript
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
```

### Q9. Solve Greatest Common Divisor (Euclid) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(log(min(a,b))), Space O(1)

```javascript
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
```

### Q10. Implement Factorial (Iterative) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function factorial(n) {
  if (n < 0) throw new Error('n must be >= 0');
  let ans = 1;
  for (let i = 2; i <= n; i++) ans *= i;
  return ans;
}
```

### Q11. Implement Factorial (Iterative) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle n = 0 and reject negative n.
- Reference complexity: Time O(n), Space O(1)

```javascript
function factorial(n) {
  if (n < 0) throw new Error('n must be >= 0');
  let ans = 1;
  for (let i = 2; i <= n; i++) ans *= i;
  return ans;
}
```

### Q12. Solve Factorial (Iterative) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function factorial(n) {
  if (n < 0) throw new Error('n must be >= 0');
  let ans = 1;
  for (let i = 2; i <= n; i++) ans *= i;
  return ans;
}
```

### Q13. Implement Fibonacci (DP Iterative) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function fib(n) {
  if (n < 0) throw new Error('n must be >= 0');
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}
```

### Q14. Implement Fibonacci (DP Iterative) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support n = 0 and n = 1 correctly.
- Reference complexity: Time O(n), Space O(1)

```javascript
function fib(n) {
  if (n < 0) throw new Error('n must be >= 0');
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}
```

### Q15. Solve Fibonacci (DP Iterative) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function fib(n) {
  if (n < 0) throw new Error('n must be >= 0');
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}
```

---

## Strings

### Q16. Implement Reverse a String in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function reverseString(s) {
  return [...s].reverse().join('');
}
```

### Q17. Implement Reverse a String and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Preserve unicode code points where possible.
- Reference complexity: Time O(n), Space O(n)

```javascript
function reverseString(s) {
  return [...s].reverse().join('');
}
```

### Q18. Solve Reverse a String with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function reverseString(s) {
  return [...s].reverse().join('');
}
```

### Q19. Implement Valid Palindrome in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1) extra

```javascript
function isPalindrome(s) {
  let l = 0, r = s.length - 1;
  const isAlphaNum = (c) => /[a-z0-9]/i.test(c);
  while (l < r) {
    while (l < r && !isAlphaNum(s[l])) l++;
    while (l < r && !isAlphaNum(s[r])) r--;
    if (s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++; r--;
  }
  return true;
}
```

### Q20. Implement Valid Palindrome and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Ignore non-alphanumeric and case differences.
- Reference complexity: Time O(n), Space O(1) extra

```javascript
function isPalindrome(s) {
  let l = 0, r = s.length - 1;
  const isAlphaNum = (c) => /[a-z0-9]/i.test(c);
  while (l < r) {
    while (l < r && !isAlphaNum(s[l])) l++;
    while (l < r && !isAlphaNum(s[r])) r--;
    if (s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++; r--;
  }
  return true;
}
```

### Q21. Solve Valid Palindrome with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1) extra

```javascript
function isPalindrome(s) {
  let l = 0, r = s.length - 1;
  const isAlphaNum = (c) => /[a-z0-9]/i.test(c);
  while (l < r) {
    while (l < r && !isAlphaNum(s[l])) l++;
    while (l < r && !isAlphaNum(s[r])) r--;
    if (s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++; r--;
  }
  return true;
}
```

### Q22. Implement Check Anagram in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function isAnagram(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length !== b.length) return false;
  const cnt = new Array(26).fill(0);
  for (let i = 0; i < a.length; i++) {
    cnt[a.charCodeAt(i) - 97]++;
    cnt[b.charCodeAt(i) - 97]--;
  }
  return cnt.every((x) => x === 0);
}
```

### Q23. Implement Check Anagram and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle spaces/punctuation if required by normalization.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function isAnagram(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length !== b.length) return false;
  const cnt = new Array(26).fill(0);
  for (let i = 0; i < a.length; i++) {
    cnt[a.charCodeAt(i) - 97]++;
    cnt[b.charCodeAt(i) - 97]--;
  }
  return cnt.every((x) => x === 0);
}
```

### Q24. Solve Check Anagram with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function isAnagram(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length !== b.length) return false;
  const cnt = new Array(26).fill(0);
  for (let i = 0; i < a.length; i++) {
    cnt[a.charCodeAt(i) - 97]++;
    cnt[b.charCodeAt(i) - 97]--;
  }
  return cnt.every((x) => x === 0);
}
```

### Q25. Implement Longest Substring Without Repeating Characters in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(min(n,charset))

```javascript
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (last.has(ch) && last.get(ch) >= left) left = last.get(ch) + 1;
    last.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

### Q26. Implement Longest Substring Without Repeating Characters and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support full ASCII/Unicode inputs.
- Reference complexity: Time O(n), Space O(min(n,charset))

```javascript
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (last.has(ch) && last.get(ch) >= left) left = last.get(ch) + 1;
    last.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

### Q27. Solve Longest Substring Without Repeating Characters with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(min(n,charset))

```javascript
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (last.has(ch) && last.get(ch) >= left) left = last.get(ch) + 1;
    last.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

### Q28. Implement String Compression (Run Length Encoding) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function compressString(s) {
  if (!s) return s;
  let out = '';
  let count = 1;
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === s[i - 1]) count++;
    else {
      out += s[i - 1] + String(count);
      count = 1;
    }
  }
  return out.length < s.length ? out : s;
}
```

### Q29. Implement String Compression (Run Length Encoding) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return original string if compressed is not shorter.
- Reference complexity: Time O(n), Space O(n)

```javascript
function compressString(s) {
  if (!s) return s;
  let out = '';
  let count = 1;
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === s[i - 1]) count++;
    else {
      out += s[i - 1] + String(count);
      count = 1;
    }
  }
  return out.length < s.length ? out : s;
}
```

### Q30. Solve String Compression (Run Length Encoding) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function compressString(s) {
  if (!s) return s;
  let out = '';
  let count = 1;
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === s[i - 1]) count++;
    else {
      out += s[i - 1] + String(count);
      count = 1;
    }
  }
  return out.length < s.length ? out : s;
}
```

---

## Arrays

### Q31. Implement Two Sum in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
```

### Q32. Implement Two Sum and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return indices and handle no-solution case.
- Reference complexity: Time O(n), Space O(n)

```javascript
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
```

### Q33. Solve Two Sum with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
```

### Q34. Implement Move Zeroes to End (In-place) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) nums[write++] = nums[read];
  }
  while (write < nums.length) nums[write++] = 0;
  return nums;
}
```

### Q35. Implement Move Zeroes to End (In-place) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Preserve order of non-zero elements.
- Reference complexity: Time O(n), Space O(1)

```javascript
function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) nums[write++] = nums[read];
  }
  while (write < nums.length) nums[write++] = 0;
  return nums;
}
```

### Q36. Solve Move Zeroes to End (In-place) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) nums[write++] = nums[read];
  }
  while (write < nums.length) nums[write++] = 0;
  return nums;
}
```

### Q37. Implement Maximum Subarray (Kadane) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function maxSubArray(nums) {
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}
```

### Q38. Implement Maximum Subarray (Kadane) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: All negative values should still return max element.
- Reference complexity: Time O(n), Space O(1)

```javascript
function maxSubArray(nums) {
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}
```

### Q39. Solve Maximum Subarray (Kadane) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function maxSubArray(nums) {
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}
```

### Q40. Implement Product of Array Except Self in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1) extra excluding output

```javascript
function productExceptSelf(nums) {
  const out = new Array(nums.length).fill(1);
  let prefix = 1;
  for (let i = 0; i < nums.length; i++) {
    out[i] = prefix;
    prefix *= nums[i];
  }
  let suffix = 1;
  for (let i = nums.length - 1; i >= 0; i--) {
    out[i] *= suffix;
    suffix *= nums[i];
  }
  return out;
}
```

### Q41. Implement Product of Array Except Self and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Do not use division; handle zeros.
- Reference complexity: Time O(n), Space O(1) extra excluding output

```javascript
function productExceptSelf(nums) {
  const out = new Array(nums.length).fill(1);
  let prefix = 1;
  for (let i = 0; i < nums.length; i++) {
    out[i] = prefix;
    prefix *= nums[i];
  }
  let suffix = 1;
  for (let i = nums.length - 1; i >= 0; i--) {
    out[i] *= suffix;
    suffix *= nums[i];
  }
  return out;
}
```

### Q42. Solve Product of Array Except Self with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1) extra excluding output

```javascript
function productExceptSelf(nums) {
  const out = new Array(nums.length).fill(1);
  let prefix = 1;
  for (let i = 0; i < nums.length; i++) {
    out[i] = prefix;
    prefix *= nums[i];
  }
  let suffix = 1;
  for (let i = nums.length - 1; i >= 0; i--) {
    out[i] *= suffix;
    suffix *= nums[i];
  }
  return out;
}
```

### Q43. Implement Rotate Array by k Steps in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function rotate(nums, k) {
  const n = nums.length;
  k %= n;
  const rev = (l, r) => {
    while (l < r) [nums[l++], nums[r--]] = [nums[r], nums[l]];
  };
  rev(0, n - 1);
  rev(0, k - 1);
  rev(k, n - 1);
  return nums;
}
```

### Q44. Implement Rotate Array by k Steps and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: k may be greater than n.
- Reference complexity: Time O(n), Space O(1)

```javascript
function rotate(nums, k) {
  const n = nums.length;
  k %= n;
  const rev = (l, r) => {
    while (l < r) [nums[l++], nums[r--]] = [nums[r], nums[l]];
  };
  rev(0, n - 1);
  rev(0, k - 1);
  rev(k, n - 1);
  return nums;
}
```

### Q45. Solve Rotate Array by k Steps with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function rotate(nums, k) {
  const n = nums.length;
  k %= n;
  const rev = (l, r) => {
    while (l < r) [nums[l++], nums[r--]] = [nums[r], nums[l]];
  };
  rev(0, n - 1);
  rev(0, k - 1);
  rev(k, n - 1);
  return nums;
}
```

---

## HashMap / Set

### Q46. Implement Frequency Map of Array in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function frequencyMap(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}
```

### Q47. Implement Frequency Map of Array and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support mixed primitive keys.
- Reference complexity: Time O(n), Space O(n)

```javascript
function frequencyMap(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}
```

### Q48. Solve Frequency Map of Array with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function frequencyMap(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}
```

### Q49. Implement First Non-Repeating Character Index in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function firstUniqChar(s) {
  const cnt = new Array(26).fill(0);
  for (const ch of s) cnt[ch.charCodeAt(0) - 97]++;
  for (let i = 0; i < s.length; i++) {
    if (cnt[s.charCodeAt(i) - 97] === 1) return i;
  }
  return -1;
}
```

### Q50. Implement First Non-Repeating Character Index and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return -1 when none exists.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function firstUniqChar(s) {
  const cnt = new Array(26).fill(0);
  for (const ch of s) cnt[ch.charCodeAt(0) - 97]++;
  for (let i = 0; i < s.length; i++) {
    if (cnt[s.charCodeAt(i) - 97] === 1) return i;
  }
  return -1;
}
```

### Q51. Solve First Non-Repeating Character Index with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1) for fixed charset

```javascript
function firstUniqChar(s) {
  const cnt = new Array(26).fill(0);
  for (const ch of s) cnt[ch.charCodeAt(0) - 97]++;
  for (let i = 0; i < s.length; i++) {
    if (cnt[s.charCodeAt(i) - 97] === 1) return i;
  }
  return -1;
}
```

### Q52. Implement Group Anagrams in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n*k log k), Space O(n*k)

```javascript
function groupAnagrams(strs) {
  const map = new Map();
  for (const s of strs) {
    const key = [...s].sort().join('');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.values()];
}
```

### Q53. Implement Group Anagrams and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Large input list should still be linear-ish.
- Reference complexity: Time O(n*k log k), Space O(n*k)

```javascript
function groupAnagrams(strs) {
  const map = new Map();
  for (const s of strs) {
    const key = [...s].sort().join('');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.values()];
}
```

### Q54. Solve Group Anagrams with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n*k log k), Space O(n*k)

```javascript
function groupAnagrams(strs) {
  const map = new Map();
  for (const s of strs) {
    const key = [...s].sort().join('');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.values()];
}
```

### Q55. Implement Top K Frequent Elements in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);
  const buckets = Array(nums.length + 1).fill(0).map(() => []);
  for (const [num, f] of freq) buckets[f].push(num);
  const out = [];
  for (let i = buckets.length - 1; i >= 0 && out.length < k; i--) {
    for (const n of buckets[i]) {
      out.push(n);
      if (out.length === k) break;
    }
  }
  return out;
}
```

### Q56. Implement Top K Frequent Elements and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: k can equal number of unique elements.
- Reference complexity: Time O(n), Space O(n)

```javascript
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);
  const buckets = Array(nums.length + 1).fill(0).map(() => []);
  for (const [num, f] of freq) buckets[f].push(num);
  const out = [];
  for (let i = buckets.length - 1; i >= 0 && out.length < k; i--) {
    for (const n of buckets[i]) {
      out.push(n);
      if (out.length === k) break;
    }
  }
  return out;
}
```

### Q57. Solve Top K Frequent Elements with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);
  const buckets = Array(nums.length + 1).fill(0).map(() => []);
  for (const [num, f] of freq) buckets[f].push(num);
  const out = [];
  for (let i = buckets.length - 1; i >= 0 && out.length < k; i--) {
    for (const n of buckets[i]) {
      out.push(n);
      if (out.length === k) break;
    }
  }
  return out;
}
```

### Q58. Implement Longest Consecutive Sequence in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (!set.has(x - 1)) {
      let y = x;
      while (set.has(y)) y++;
      best = Math.max(best, y - x);
    }
  }
  return best;
}
```

### Q59. Implement Longest Consecutive Sequence and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Unsorted array with duplicates.
- Reference complexity: Time O(n), Space O(n)

```javascript
function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (!set.has(x - 1)) {
      let y = x;
      while (set.has(y)) y++;
      best = Math.max(best, y - x);
    }
  }
  return best;
}
```

### Q60. Solve Longest Consecutive Sequence with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (!set.has(x - 1)) {
      let y = x;
      while (set.has(y)) y++;
      best = Math.max(best, y - x);
    }
  }
  return best;
}
```

---

## Recursion / Backtracking

### Q61. Implement Generate All Subsets (Power Set) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n*2^n), Space O(n*2^n)

```javascript
function subsets(nums) {
  const out = [];
  const path = [];
  const dfs = (i) => {
    if (i === nums.length) return out.push([...path]);
    dfs(i + 1);
    path.push(nums[i]);
    dfs(i + 1);
    path.pop();
  };
  dfs(0);
  return out;
}
```

### Q62. Implement Generate All Subsets (Power Set) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle empty input array.
- Reference complexity: Time O(n*2^n), Space O(n*2^n)

```javascript
function subsets(nums) {
  const out = [];
  const path = [];
  const dfs = (i) => {
    if (i === nums.length) return out.push([...path]);
    dfs(i + 1);
    path.push(nums[i]);
    dfs(i + 1);
    path.pop();
  };
  dfs(0);
  return out;
}
```

### Q63. Solve Generate All Subsets (Power Set) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n*2^n), Space O(n*2^n)

```javascript
function subsets(nums) {
  const out = [];
  const path = [];
  const dfs = (i) => {
    if (i === nums.length) return out.push([...path]);
    dfs(i + 1);
    path.push(nums[i]);
    dfs(i + 1);
    path.pop();
  };
  dfs(0);
  return out;
}
```

### Q64. Implement Generate Permutations in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n*n!), Space O(n*n!)

```javascript
function permute(nums) {
  const out = [];
  const used = new Array(nums.length).fill(false);
  const path = [];
  const dfs = () => {
    if (path.length === nums.length) return out.push([...path]);
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);
      dfs();
      path.pop(); used[i] = false;
    }
  };
  dfs();
  return out;
}
```

### Q65. Implement Generate Permutations and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: If duplicates exist, use set-based dedupe.
- Reference complexity: Time O(n*n!), Space O(n*n!)

```javascript
function permute(nums) {
  const out = [];
  const used = new Array(nums.length).fill(false);
  const path = [];
  const dfs = () => {
    if (path.length === nums.length) return out.push([...path]);
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);
      dfs();
      path.pop(); used[i] = false;
    }
  };
  dfs();
  return out;
}
```

### Q66. Solve Generate Permutations with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n*n!), Space O(n*n!)

```javascript
function permute(nums) {
  const out = [];
  const used = new Array(nums.length).fill(false);
  const path = [];
  const dfs = () => {
    if (path.length === nums.length) return out.push([...path]);
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);
      dfs();
      path.pop(); used[i] = false;
    }
  };
  dfs();
  return out;
}
```

### Q67. Implement Combination Sum in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time exponential (search tree), Space O(target)

```javascript
function combinationSum(candidates, target) {
  const out = [], path = [];
  const dfs = (start, rem) => {
    if (rem === 0) return out.push([...path]);
    if (rem < 0) return;
    for (let i = start; i < candidates.length; i++) {
      path.push(candidates[i]);
      dfs(i, rem - candidates[i]);
      path.pop();
    }
  };
  dfs(0, target);
  return out;
}
```

### Q68. Implement Combination Sum and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Candidates can be reused; avoid invalid branches early.
- Reference complexity: Time exponential (search tree), Space O(target)

```javascript
function combinationSum(candidates, target) {
  const out = [], path = [];
  const dfs = (start, rem) => {
    if (rem === 0) return out.push([...path]);
    if (rem < 0) return;
    for (let i = start; i < candidates.length; i++) {
      path.push(candidates[i]);
      dfs(i, rem - candidates[i]);
      path.pop();
    }
  };
  dfs(0, target);
  return out;
}
```

### Q69. Solve Combination Sum with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time exponential (search tree), Space O(target)

```javascript
function combinationSum(candidates, target) {
  const out = [], path = [];
  const dfs = (start, rem) => {
    if (rem === 0) return out.push([...path]);
    if (rem < 0) return;
    for (let i = start; i < candidates.length; i++) {
      path.push(candidates[i]);
      dfs(i, rem - candidates[i]);
      path.pop();
    }
  };
  dfs(0, target);
  return out;
}
```

### Q70. Implement Generate Valid Parentheses in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(Catalan(n)), Space O(n)

```javascript
function generateParenthesis(n) {
  const out = [];
  const dfs = (open, close, cur) => {
    if (cur.length === 2 * n) return out.push(cur);
    if (open < n) dfs(open + 1, close, cur + '(');
    if (close < open) dfs(open, close + 1, cur + ')');
  };
  dfs(0, 0, '');
  return out;
}
```

### Q71. Implement Generate Valid Parentheses and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: n = 0 should return [""].
- Reference complexity: Time O(Catalan(n)), Space O(n)

```javascript
function generateParenthesis(n) {
  const out = [];
  const dfs = (open, close, cur) => {
    if (cur.length === 2 * n) return out.push(cur);
    if (open < n) dfs(open + 1, close, cur + '(');
    if (close < open) dfs(open, close + 1, cur + ')');
  };
  dfs(0, 0, '');
  return out;
}
```

### Q72. Solve Generate Valid Parentheses with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(Catalan(n)), Space O(n)

```javascript
function generateParenthesis(n) {
  const out = [];
  const dfs = (open, close, cur) => {
    if (cur.length === 2 * n) return out.push(cur);
    if (open < n) dfs(open + 1, close, cur + '(');
    if (close < open) dfs(open, close + 1, cur + ')');
  };
  dfs(0, 0, '');
  return out;
}
```

### Q73. Implement N-Queens Count in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time exponential, Space O(n)

```javascript
function totalNQueens(n) {
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  let count = 0;
  const dfs = (r) => {
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      cols.add(c); d1.add(r - c); d2.add(r + c);
      dfs(r + 1);
      cols.delete(c); d1.delete(r - c); d2.delete(r + c);
    }
  };
  dfs(0);
  return count;
}
```

### Q74. Implement N-Queens Count and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return number of valid board arrangements.
- Reference complexity: Time exponential, Space O(n)

```javascript
function totalNQueens(n) {
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  let count = 0;
  const dfs = (r) => {
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      cols.add(c); d1.add(r - c); d2.add(r + c);
      dfs(r + 1);
      cols.delete(c); d1.delete(r - c); d2.delete(r + c);
    }
  };
  dfs(0);
  return count;
}
```

### Q75. Solve N-Queens Count with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time exponential, Space O(n)

```javascript
function totalNQueens(n) {
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  let count = 0;
  const dfs = (r) => {
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      cols.add(c); d1.add(r - c); d2.add(r + c);
      dfs(r + 1);
      cols.delete(c); d1.delete(r - c); d2.delete(r + c);
    }
  };
  dfs(0);
  return count;
}
```

---

## Sorting / Searching

### Q76. Implement Merge Sort in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n log n), Space O(n)

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}
```

### Q77. Implement Merge Sort and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Stable sort implementation.
- Reference complexity: Time O(n log n), Space O(n)

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}
```

### Q78. Solve Merge Sort with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n log n), Space O(n)

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}
```

### Q79. Implement Quick Sort in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Avg O(n log n), Worst O(n^2), Space O(log n) stack avg

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [], right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    (arr[i] < pivot ? left : right).push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}
```

### Q80. Implement Quick Sort and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Worst case can be O(n^2) without good pivot strategy.
- Reference complexity: Avg O(n log n), Worst O(n^2), Space O(log n) stack avg

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [], right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    (arr[i] < pivot ? left : right).push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}
```

### Q81. Solve Quick Sort with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Avg O(n log n), Worst O(n^2), Space O(log n) stack avg

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [], right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    (arr[i] < pivot ? left : right).push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}
```

### Q82. Implement Binary Search in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function binarySearch(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[m] < target) l = m + 1;
    else r = m - 1;
  }
  return -1;
}
```

### Q83. Implement Binary Search and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return -1 if target not found.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function binarySearch(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[m] < target) l = m + 1;
    else r = m - 1;
  }
  return -1;
}
```

### Q84. Solve Binary Search with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function binarySearch(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[m] < target) l = m + 1;
    else r = m - 1;
  }
  return -1;
}
```

### Q85. Implement Search in Rotated Sorted Array in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function searchRotated(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[l] <= nums[m]) {
      if (nums[l] <= target && target < nums[m]) r = m - 1;
      else l = m + 1;
    } else {
      if (nums[m] < target && target <= nums[r]) l = m + 1;
      else r = m - 1;
    }
  }
  return -1;
}
```

### Q86. Implement Search in Rotated Sorted Array and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Array has unique values and is rotated once.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function searchRotated(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[l] <= nums[m]) {
      if (nums[l] <= target && target < nums[m]) r = m - 1;
      else l = m + 1;
    } else {
      if (nums[m] < target && target <= nums[r]) l = m + 1;
      else r = m - 1;
    }
  }
  return -1;
}
```

### Q87. Solve Search in Rotated Sorted Array with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(log n), Space O(1)

```javascript
function searchRotated(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    if (nums[m] === target) return m;
    if (nums[l] <= nums[m]) {
      if (nums[l] <= target && target < nums[m]) r = m - 1;
      else l = m + 1;
    } else {
      if (nums[m] < target && target <= nums[r]) l = m + 1;
      else r = m - 1;
    }
  }
  return -1;
}
```

### Q88. Implement Kth Largest (Quickselect) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Avg O(n), Worst O(n^2), Space O(1)

```javascript
function findKthLargest(nums, k) {
  const target = nums.length - k;
  let l = 0, r = nums.length - 1;
  const part = (lo, hi) => {
    const pivot = nums[hi];
    let p = lo;
    for (let i = lo; i < hi; i++) {
      if (nums[i] <= pivot) [nums[i], nums[p]] = [nums[p], nums[i]], p++;
    }
    [nums[p], nums[hi]] = [nums[hi], nums[p]];
    return p;
  };
  while (l <= r) {
    const p = part(l, r);
    if (p === target) return nums[p];
    if (p < target) l = p + 1;
    else r = p - 1;
  }
}
```

### Q89. Implement Kth Largest (Quickselect) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: k is 1-based (k=1 means max).
- Reference complexity: Avg O(n), Worst O(n^2), Space O(1)

```javascript
function findKthLargest(nums, k) {
  const target = nums.length - k;
  let l = 0, r = nums.length - 1;
  const part = (lo, hi) => {
    const pivot = nums[hi];
    let p = lo;
    for (let i = lo; i < hi; i++) {
      if (nums[i] <= pivot) [nums[i], nums[p]] = [nums[p], nums[i]], p++;
    }
    [nums[p], nums[hi]] = [nums[hi], nums[p]];
    return p;
  };
  while (l <= r) {
    const p = part(l, r);
    if (p === target) return nums[p];
    if (p < target) l = p + 1;
    else r = p - 1;
  }
}
```

### Q90. Solve Kth Largest (Quickselect) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Avg O(n), Worst O(n^2), Space O(1)

```javascript
function findKthLargest(nums, k) {
  const target = nums.length - k;
  let l = 0, r = nums.length - 1;
  const part = (lo, hi) => {
    const pivot = nums[hi];
    let p = lo;
    for (let i = lo; i < hi; i++) {
      if (nums[i] <= pivot) [nums[i], nums[p]] = [nums[p], nums[i]], p++;
    }
    [nums[p], nums[hi]] = [nums[hi], nums[p]];
    return p;
  };
  while (l <= r) {
    const p = part(l, r);
    if (p === target) return nums[p];
    if (p < target) l = p + 1;
    else r = p - 1;
  }
}
```

---

## Linked List

### Q91. Implement Reverse Linked List in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;
    cur.next = prev;
    prev = cur;
    cur = next;
  }
  return prev;
}
```

### Q92. Implement Reverse Linked List and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle empty and single-node lists.
- Reference complexity: Time O(n), Space O(1)

```javascript
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;
    cur.next = prev;
    prev = cur;
    cur = next;
  }
  return prev;
}
```

### Q93. Solve Reverse Linked List with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;
    cur.next = prev;
    prev = cur;
    cur = next;
  }
  return prev;
}
```

### Q94. Implement Detect Cycle (Floyd) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

### Q95. Implement Detect Cycle (Floyd) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return true if cycle exists.
- Reference complexity: Time O(n), Space O(1)

```javascript
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

### Q96. Solve Detect Cycle (Floyd) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

### Q97. Implement Merge Two Sorted Lists in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n+m), Space O(1) extra

```javascript
function mergeTwoLists(l1, l2) {
  const dummy = { next: null };
  let tail = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
    else { tail.next = l2; l2 = l2.next; }
    tail = tail.next;
  }
  tail.next = l1 || l2;
  return dummy.next;
}
```

### Q98. Implement Merge Two Sorted Lists and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Both lists can be null.
- Reference complexity: Time O(n+m), Space O(1) extra

```javascript
function mergeTwoLists(l1, l2) {
  const dummy = { next: null };
  let tail = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
    else { tail.next = l2; l2 = l2.next; }
    tail = tail.next;
  }
  tail.next = l1 || l2;
  return dummy.next;
}
```

### Q99. Solve Merge Two Sorted Lists with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n+m), Space O(1) extra

```javascript
function mergeTwoLists(l1, l2) {
  const dummy = { next: null };
  let tail = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
    else { tail.next = l2; l2 = l2.next; }
    tail = tail.next;
  }
  tail.next = l1 || l2;
  return dummy.next;
}
```

### Q100. Implement Remove Nth Node From End in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function removeNthFromEnd(head, n) {
  const dummy = { val: 0, next: head };
  let fast = dummy, slow = dummy;
  for (let i = 0; i < n; i++) fast = fast.next;
  while (fast.next) {
    fast = fast.next;
    slow = slow.next;
  }
  slow.next = slow.next.next;
  return dummy.next;
}
```

### Q101. Implement Remove Nth Node From End and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: If n equals length, remove head.
- Reference complexity: Time O(n), Space O(1)

```javascript
function removeNthFromEnd(head, n) {
  const dummy = { val: 0, next: head };
  let fast = dummy, slow = dummy;
  for (let i = 0; i < n; i++) fast = fast.next;
  while (fast.next) {
    fast = fast.next;
    slow = slow.next;
  }
  slow.next = slow.next.next;
  return dummy.next;
}
```

### Q102. Solve Remove Nth Node From End with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function removeNthFromEnd(head, n) {
  const dummy = { val: 0, next: head };
  let fast = dummy, slow = dummy;
  for (let i = 0; i < n; i++) fast = fast.next;
  while (fast.next) {
    fast = fast.next;
    slow = slow.next;
  }
  slow.next = slow.next.next;
  return dummy.next;
}
```

### Q103. Implement Find Middle Node in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}
```

### Q104. Implement Find Middle Node and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: If even length, return second middle.
- Reference complexity: Time O(n), Space O(1)

```javascript
function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}
```

### Q105. Solve Find Middle Node with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}
```

---

## Stack / Queue

### Q106. Implement Valid Parentheses in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function isValid(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const st = [];
  for (const ch of s) {
    if (ch in map) {
      if (st.pop() !== map[ch]) return false;
    } else st.push(ch);
  }
  return st.length === 0;
}
```

### Q107. Implement Valid Parentheses and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support (), {}, [] pairs only.
- Reference complexity: Time O(n), Space O(n)

```javascript
function isValid(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const st = [];
  for (const ch of s) {
    if (ch in map) {
      if (st.pop() !== map[ch]) return false;
    } else st.push(ch);
  }
  return st.length === 0;
}
```

### Q108. Solve Valid Parentheses with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function isValid(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const st = [];
  for (const ch of s) {
    if (ch in map) {
      if (st.pop() !== map[ch]) return false;
    } else st.push(ch);
  }
  return st.length === 0;
}
```

### Q109. Implement Min Stack in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(1) per op, Space O(n)

```javascript
class MinStack {
  constructor() { this.st = []; this.minSt = []; }
  push(x) {
    this.st.push(x);
    if (this.minSt.length === 0 || x <= this.getMin()) this.minSt.push(x);
  }
  pop() {
    const x = this.st.pop();
    if (x === this.getMin()) this.minSt.pop();
    return x;
  }
  top() { return this.st[this.st.length - 1]; }
  getMin() { return this.minSt[this.minSt.length - 1]; }
}
```

### Q110. Implement Min Stack and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: All ops should be O(1).
- Reference complexity: Time O(1) per op, Space O(n)

```javascript
class MinStack {
  constructor() { this.st = []; this.minSt = []; }
  push(x) {
    this.st.push(x);
    if (this.minSt.length === 0 || x <= this.getMin()) this.minSt.push(x);
  }
  pop() {
    const x = this.st.pop();
    if (x === this.getMin()) this.minSt.pop();
    return x;
  }
  top() { return this.st[this.st.length - 1]; }
  getMin() { return this.minSt[this.minSt.length - 1]; }
}
```

### Q111. Solve Min Stack with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(1) per op, Space O(n)

```javascript
class MinStack {
  constructor() { this.st = []; this.minSt = []; }
  push(x) {
    this.st.push(x);
    if (this.minSt.length === 0 || x <= this.getMin()) this.minSt.push(x);
  }
  pop() {
    const x = this.st.pop();
    if (x === this.getMin()) this.minSt.pop();
    return x;
  }
  top() { return this.st[this.st.length - 1]; }
  getMin() { return this.minSt[this.minSt.length - 1]; }
}
```

### Q112. Implement Next Greater Element in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function nextGreater(nums) {
  const out = new Array(nums.length).fill(-1);
  const st = [];
  for (let i = 0; i < nums.length; i++) {
    while (st.length && nums[i] > nums[st[st.length - 1]]) {
      out[st.pop()] = nums[i];
    }
    st.push(i);
  }
  return out;
}
```

### Q113. Implement Next Greater Element and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return -1 when no greater element exists.
- Reference complexity: Time O(n), Space O(n)

```javascript
function nextGreater(nums) {
  const out = new Array(nums.length).fill(-1);
  const st = [];
  for (let i = 0; i < nums.length; i++) {
    while (st.length && nums[i] > nums[st[st.length - 1]]) {
      out[st.pop()] = nums[i];
    }
    st.push(i);
  }
  return out;
}
```

### Q114. Solve Next Greater Element with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function nextGreater(nums) {
  const out = new Array(nums.length).fill(-1);
  const st = [];
  for (let i = 0; i < nums.length; i++) {
    while (st.length && nums[i] > nums[st[st.length - 1]]) {
      out[st.pop()] = nums[i];
    }
    st.push(i);
  }
  return out;
}
```

### Q115. Implement Queue Using Two Stacks in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Amortized O(1) per op, Space O(n)

```javascript
class MyQueue {
  constructor() { this.in = []; this.out = []; }
  _shift() { if (!this.out.length) while (this.in.length) this.out.push(this.in.pop()); }
  push(x) { this.in.push(x); }
  pop() { this._shift(); return this.out.pop(); }
  peek() { this._shift(); return this.out[this.out.length - 1]; }
  empty() { return this.in.length === 0 && this.out.length === 0; }
}
```

### Q116. Implement Queue Using Two Stacks and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Amortized O(1) operations.
- Reference complexity: Amortized O(1) per op, Space O(n)

```javascript
class MyQueue {
  constructor() { this.in = []; this.out = []; }
  _shift() { if (!this.out.length) while (this.in.length) this.out.push(this.in.pop()); }
  push(x) { this.in.push(x); }
  pop() { this._shift(); return this.out.pop(); }
  peek() { this._shift(); return this.out[this.out.length - 1]; }
  empty() { return this.in.length === 0 && this.out.length === 0; }
}
```

### Q117. Solve Queue Using Two Stacks with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Amortized O(1) per op, Space O(n)

```javascript
class MyQueue {
  constructor() { this.in = []; this.out = []; }
  _shift() { if (!this.out.length) while (this.in.length) this.out.push(this.in.pop()); }
  push(x) { this.in.push(x); }
  pop() { this._shift(); return this.out.pop(); }
  peek() { this._shift(); return this.out[this.out.length - 1]; }
  empty() { return this.in.length === 0 && this.out.length === 0; }
}
```

### Q118. Implement Sliding Window Maximum in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(k)

```javascript
function maxSlidingWindow(nums, k) {
  const dq = []; // indices, decreasing values
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    while (dq.length && dq[0] <= i - k) dq.shift();
    while (dq.length && nums[dq[dq.length - 1]] <= nums[i]) dq.pop();
    dq.push(i);
    if (i >= k - 1) out.push(nums[dq[0]]);
  }
  return out;
}
```

### Q119. Implement Sliding Window Maximum and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Use deque for O(n) solution.
- Reference complexity: Time O(n), Space O(k)

```javascript
function maxSlidingWindow(nums, k) {
  const dq = []; // indices, decreasing values
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    while (dq.length && dq[0] <= i - k) dq.shift();
    while (dq.length && nums[dq[dq.length - 1]] <= nums[i]) dq.pop();
    dq.push(i);
    if (i >= k - 1) out.push(nums[dq[0]]);
  }
  return out;
}
```

### Q120. Solve Sliding Window Maximum with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(k)

```javascript
function maxSlidingWindow(nums, k) {
  const dq = []; // indices, decreasing values
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    while (dq.length && dq[0] <= i - k) dq.shift();
    while (dq.length && nums[dq[dq.length - 1]] <= nums[i]) dq.pop();
    dq.push(i);
    if (i >= k - 1) out.push(nums[dq[0]]);
  }
  return out;
}
```

---

## Trees

### Q121. Implement Inorder Traversal (Iterative) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(h)

```javascript
function inorderTraversal(root) {
  const st = [], out = [];
  let cur = root;
  while (cur || st.length) {
    while (cur) { st.push(cur); cur = cur.left; }
    cur = st.pop();
    out.push(cur.val);
    cur = cur.right;
  }
  return out;
}
```

### Q122. Implement Inorder Traversal (Iterative) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Avoid recursion stack overflow for deep trees.
- Reference complexity: Time O(n), Space O(h)

```javascript
function inorderTraversal(root) {
  const st = [], out = [];
  let cur = root;
  while (cur || st.length) {
    while (cur) { st.push(cur); cur = cur.left; }
    cur = st.pop();
    out.push(cur.val);
    cur = cur.right;
  }
  return out;
}
```

### Q123. Solve Inorder Traversal (Iterative) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(h)

```javascript
function inorderTraversal(root) {
  const st = [], out = [];
  let cur = root;
  while (cur || st.length) {
    while (cur) { st.push(cur); cur = cur.left; }
    cur = st.pop();
    out.push(cur.val);
    cur = cur.right;
  }
  return out;
}
```

### Q124. Implement Maximum Depth of Binary Tree in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(h)

```javascript
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

### Q125. Implement Maximum Depth of Binary Tree and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Empty tree depth is 0.
- Reference complexity: Time O(n), Space O(h)

```javascript
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

### Q126. Solve Maximum Depth of Binary Tree with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(h)

```javascript
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

### Q127. Implement Validate Binary Search Tree in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(h)

```javascript
function isValidBST(root) {
  const dfs = (node, lo, hi) => {
    if (!node) return true;
    if (!(lo < node.val && node.val < hi)) return false;
    return dfs(node.left, lo, node.val) && dfs(node.right, node.val, hi);
  };
  return dfs(root, -Infinity, Infinity);
}
```

### Q128. Implement Validate Binary Search Tree and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Strict inequality: duplicates invalid in BST.
- Reference complexity: Time O(n), Space O(h)

```javascript
function isValidBST(root) {
  const dfs = (node, lo, hi) => {
    if (!node) return true;
    if (!(lo < node.val && node.val < hi)) return false;
    return dfs(node.left, lo, node.val) && dfs(node.right, node.val, hi);
  };
  return dfs(root, -Infinity, Infinity);
}
```

### Q129. Solve Validate Binary Search Tree with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(h)

```javascript
function isValidBST(root) {
  const dfs = (node, lo, hi) => {
    if (!node) return true;
    if (!(lo < node.val && node.val < hi)) return false;
    return dfs(node.left, lo, node.val) && dfs(node.right, node.val, hi);
  };
  return dfs(root, -Infinity, Infinity);
}
```

### Q130. Implement Level Order Traversal in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(w)

```javascript
function levelOrder(root) {
  if (!root) return [];
  const q = [root], out = [];
  while (q.length) {
    const size = q.length, level = [];
    for (let i = 0; i < size; i++) {
      const node = q.shift();
      level.push(node.val);
      if (node.left) q.push(node.left);
      if (node.right) q.push(node.right);
    }
    out.push(level);
  }
  return out;
}
```

### Q131. Implement Level Order Traversal and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return list of levels.
- Reference complexity: Time O(n), Space O(w)

```javascript
function levelOrder(root) {
  if (!root) return [];
  const q = [root], out = [];
  while (q.length) {
    const size = q.length, level = [];
    for (let i = 0; i < size; i++) {
      const node = q.shift();
      level.push(node.val);
      if (node.left) q.push(node.left);
      if (node.right) q.push(node.right);
    }
    out.push(level);
  }
  return out;
}
```

### Q132. Solve Level Order Traversal with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(w)

```javascript
function levelOrder(root) {
  if (!root) return [];
  const q = [root], out = [];
  while (q.length) {
    const size = q.length, level = [];
    for (let i = 0; i < size; i++) {
      const node = q.shift();
      level.push(node.val);
      if (node.left) q.push(node.left);
      if (node.right) q.push(node.right);
    }
    out.push(level);
  }
  return out;
}
```

### Q133. Implement Lowest Common Ancestor in BST in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(h), Space O(1)

```javascript
function lowestCommonAncestor(root, p, q) {
  let cur = root;
  while (cur) {
    if (p.val < cur.val && q.val < cur.val) cur = cur.left;
    else if (p.val > cur.val && q.val > cur.val) cur = cur.right;
    else return cur;
  }
  return null;
}
```

### Q134. Implement Lowest Common Ancestor in BST and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Assume both nodes exist in tree.
- Reference complexity: Time O(h), Space O(1)

```javascript
function lowestCommonAncestor(root, p, q) {
  let cur = root;
  while (cur) {
    if (p.val < cur.val && q.val < cur.val) cur = cur.left;
    else if (p.val > cur.val && q.val > cur.val) cur = cur.right;
    else return cur;
  }
  return null;
}
```

### Q135. Solve Lowest Common Ancestor in BST with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(h), Space O(1)

```javascript
function lowestCommonAncestor(root, p, q) {
  let cur = root;
  while (cur) {
    if (p.val < cur.val && q.val < cur.val) cur = cur.left;
    else if (p.val > cur.val && q.val > cur.val) cur = cur.right;
    else return cur;
  }
  return null;
}
```

---

## Graphs

### Q136. Implement BFS Traversal (Adjacency List) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function bfs(graph, start) {
  const q = [start], seen = new Set([start]), out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of (graph[u] || [])) {
      if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  return out;
}
```

### Q137. Implement BFS Traversal (Adjacency List) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle disconnected graph by BFS from a given start.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function bfs(graph, start) {
  const q = [start], seen = new Set([start]), out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of (graph[u] || [])) {
      if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  return out;
}
```

### Q138. Solve BFS Traversal (Adjacency List) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function bfs(graph, start) {
  const q = [start], seen = new Set([start]), out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of (graph[u] || [])) {
      if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  return out;
}
```

### Q139. Implement DFS Traversal (Iterative) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function dfs(graph, start) {
  const st = [start], seen = new Set(), out = [];
  while (st.length) {
    const u = st.pop();
    if (seen.has(u)) continue;
    seen.add(u); out.push(u);
    const nei = graph[u] || [];
    for (let i = nei.length - 1; i >= 0; i--) st.push(nei[i]);
  }
  return out;
}
```

### Q140. Implement DFS Traversal (Iterative) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Use stack to avoid recursion depth limits.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function dfs(graph, start) {
  const st = [start], seen = new Set(), out = [];
  while (st.length) {
    const u = st.pop();
    if (seen.has(u)) continue;
    seen.add(u); out.push(u);
    const nei = graph[u] || [];
    for (let i = nei.length - 1; i >= 0; i--) st.push(nei[i]);
  }
  return out;
}
```

### Q141. Solve DFS Traversal (Iterative) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function dfs(graph, start) {
  const st = [start], seen = new Set(), out = [];
  while (st.length) {
    const u = st.pop();
    if (seen.has(u)) continue;
    seen.add(u); out.push(u);
    const nei = graph[u] || [];
    for (let i = nei.length - 1; i >= 0; i--) st.push(nei[i]);
  }
  return out;
}
```

### Q142. Implement Number of Islands in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(m*n), Space O(m*n) worst recursion/stack

```javascript
function numIslands(grid) {
  if (!grid.length) return 0;
  const m = grid.length, n = grid[0].length;
  let count = 0;
  const dfs = (r, c) => {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] !== '1') return;
    grid[r][c] = '0';
    dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1);
  };
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === '1') { count++; dfs(r, c); }
    }
  }
  return count;
}
```

### Q143. Implement Number of Islands and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Grid may be large; mutate visited cells to save space.
- Reference complexity: Time O(m*n), Space O(m*n) worst recursion/stack

```javascript
function numIslands(grid) {
  if (!grid.length) return 0;
  const m = grid.length, n = grid[0].length;
  let count = 0;
  const dfs = (r, c) => {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] !== '1') return;
    grid[r][c] = '0';
    dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1);
  };
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === '1') { count++; dfs(r, c); }
    }
  }
  return count;
}
```

### Q144. Solve Number of Islands with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(m*n), Space O(m*n) worst recursion/stack

```javascript
function numIslands(grid) {
  if (!grid.length) return 0;
  const m = grid.length, n = grid[0].length;
  let count = 0;
  const dfs = (r, c) => {
    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] !== '1') return;
    grid[r][c] = '0';
    dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1);
  };
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === '1') { count++; dfs(r, c); }
    }
  }
  return count;
}
```

### Q145. Implement Topological Sort (Kahn's Algorithm) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function topoSort(n, edges) {
  const g = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const [u, v] of edges) { g[u].push(v); indeg[v]++; }
  const q = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
  const out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of g[u]) if (--indeg[v] === 0) q.push(v);
  }
  return out.length === n ? out : [];
}
```

### Q146. Implement Topological Sort (Kahn's Algorithm) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return [] if graph has cycle.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function topoSort(n, edges) {
  const g = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const [u, v] of edges) { g[u].push(v); indeg[v]++; }
  const q = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
  const out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of g[u]) if (--indeg[v] === 0) q.push(v);
  }
  return out.length === n ? out : [];
}
```

### Q147. Solve Topological Sort (Kahn's Algorithm) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(V+E), Space O(V)

```javascript
function topoSort(n, edges) {
  const g = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const [u, v] of edges) { g[u].push(v); indeg[v]++; }
  const q = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
  const out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of g[u]) if (--indeg[v] === 0) q.push(v);
  }
  return out.length === n ? out : [];
}
```

### Q148. Implement Dijkstra (Non-negative Weights) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Using sorted array PQ: O((V+E)logV)

```javascript
function dijkstra(n, adj, src) {
  const dist = new Array(n).fill(Infinity);
  dist[src] = 0;
  const pq = [[0, src]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (d !== dist[u]) continue;
    for (const [v, w] of (adj[u] || [])) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        pq.push([dist[v], v]);
      }
    }
  }
  return dist;
}
```

### Q149. Implement Dijkstra (Non-negative Weights) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Use min-priority queue in production for better performance.
- Reference complexity: Using sorted array PQ: O((V+E)logV)

```javascript
function dijkstra(n, adj, src) {
  const dist = new Array(n).fill(Infinity);
  dist[src] = 0;
  const pq = [[0, src]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (d !== dist[u]) continue;
    for (const [v, w] of (adj[u] || [])) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        pq.push([dist[v], v]);
      }
    }
  }
  return dist;
}
```

### Q150. Solve Dijkstra (Non-negative Weights) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Using sorted array PQ: O((V+E)logV)

```javascript
function dijkstra(n, adj, src) {
  const dist = new Array(n).fill(Infinity);
  dist[src] = 0;
  const pq = [[0, src]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (d !== dist[u]) continue;
    for (const [v, w] of (adj[u] || [])) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        pq.push([dist[v], v]);
      }
    }
  }
  return dist;
}
```

---

## Async / Promise

### Q151. Implement Sleep Function in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(1) scheduling

```javascript
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Q152. Implement Sleep Function and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Return a Promise resolved after ms.
- Reference complexity: Time O(1) scheduling

```javascript
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Q153. Solve Sleep Function with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(1) scheduling

```javascript
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Q154. Implement Promise.all Polyfill in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const arr = Array.from(promises);
    if (arr.length === 0) return resolve([]);
    const out = new Array(arr.length);
    let done = 0;
    arr.forEach((p, i) => {
      Promise.resolve(p).then((val) => {
        out[i] = val;
        if (++done === arr.length) resolve(out);
      }, reject);
    });
  });
}
```

### Q155. Implement Promise.all Polyfill and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Reject fast on first rejection.
- Reference complexity: Time O(n), Space O(n)

```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const arr = Array.from(promises);
    if (arr.length === 0) return resolve([]);
    const out = new Array(arr.length);
    let done = 0;
    arr.forEach((p, i) => {
      Promise.resolve(p).then((val) => {
        out[i] = val;
        if (++done === arr.length) resolve(out);
      }, reject);
    });
  });
}
```

### Q156. Solve Promise.all Polyfill with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const arr = Array.from(promises);
    if (arr.length === 0) return resolve([]);
    const out = new Array(arr.length);
    let done = 0;
    arr.forEach((p, i) => {
      Promise.resolve(p).then((val) => {
        out[i] = val;
        if (++done === arr.length) resolve(out);
      }, reject);
    });
  });
}
```

### Q157. Implement Promise.race Polyfill in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(1)

```javascript
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}
```

### Q158. Implement Promise.race Polyfill and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Resolve/reject with first settled promise.
- Reference complexity: Time O(n), Space O(1)

```javascript
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}
```

### Q159. Solve Promise.race Polyfill with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(1)

```javascript
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}
```

### Q160. Implement Fetch With Retry in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: O(retries) network attempts

```javascript
async function fetchWithRetry(fn, retries = 3, delay = 200) {
  let err;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      err = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw err;
}
```

### Q161. Implement Fetch With Retry and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Retry only transient failures and respect max attempts.
- Reference complexity: O(retries) network attempts

```javascript
async function fetchWithRetry(fn, retries = 3, delay = 200) {
  let err;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      err = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw err;
}
```

### Q162. Solve Fetch With Retry with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: O(retries) network attempts

```javascript
async function fetchWithRetry(fn, retries = 3, delay = 200) {
  let err;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      err = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw err;
}
```

### Q163. Implement Limit Concurrency (p-limit style) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
async function runWithLimit(tasks, k) {
  const out = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(k, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      out[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return out;
}
```

### Q164. Implement Limit Concurrency (p-limit style) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Keep at most k tasks running at a time.
- Reference complexity: Time O(n), Space O(n)

```javascript
async function runWithLimit(tasks, k) {
  const out = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(k, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      out[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return out;
}
```

### Q165. Solve Limit Concurrency (p-limit style) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
async function runWithLimit(tasks, k) {
  const out = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(k, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      out[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return out;
}
```

---

## JS Advanced / Utility / OOP

### Q166. Implement Debounce Function in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(1) per call

```javascript
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

### Q167. Implement Debounce Function and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Only run after no calls for wait ms.
- Reference complexity: Time O(1) per call

```javascript
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

### Q168. Solve Debounce Function with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(1) per call

```javascript
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

### Q169. Implement Throttle Function in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(1) per call

```javascript
function throttle(fn, wait) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

### Q170. Implement Throttle Function and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Run at most once per wait window.
- Reference complexity: Time O(1) per call

```javascript
function throttle(fn, wait) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

### Q171. Solve Throttle Function with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(1) per call

```javascript
function throttle(fn, wait) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

### Q172. Implement Deep Clone (with circular reference support) in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(n), Space O(n)

```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const k of Object.keys(value)) out[k] = deepClone(value[k], seen);
  return out;
}
```

### Q173. Implement Deep Clone (with circular reference support) and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Handle arrays/objects and circular refs.
- Reference complexity: Time O(n), Space O(n)

```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const k of Object.keys(value)) out[k] = deepClone(value[k], seen);
  return out;
}
```

### Q174. Solve Deep Clone (with circular reference support) with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(n), Space O(n)

```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const k of Object.keys(value)) out[k] = deepClone(value[k], seen);
  return out;
}
```

### Q175. Implement EventEmitter Class in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Emit O(n listeners)

```javascript
class EventEmitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt, ...args) {
    for (const fn of this.map.get(evt) || []) fn(...args);
  }
}
```

### Q176. Implement EventEmitter Class and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Support on, off, and emit.
- Reference complexity: Emit O(n listeners)

```javascript
class EventEmitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt, ...args) {
    for (const fn of this.map.get(evt) || []) fn(...args);
  }
}
```

### Q177. Solve EventEmitter Class with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Emit O(n listeners)

```javascript
class EventEmitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt, ...args) {
    for (const fn of this.map.get(evt) || []) fn(...args);
  }
}
```

### Q178. Implement Custom bind Polyfill in JavaScript.

**Answer:**

- Approach: Use the standard optimal pattern for coding rounds.
- Reference complexity: Time O(1) wrapper

```javascript
Function.prototype.myBind = function (ctx, ...preset) {
  const fn = this;
  return function (...later) {
    return fn.apply(ctx, [...preset, ...later]);
  };
};
```

### Q179. Implement Custom bind Polyfill and explicitly handle edge cases.

**Answer:**

- Approach: Important edge case: Preserve partial args and call-time args.
- Reference complexity: Time O(1) wrapper

```javascript
Function.prototype.myBind = function (ctx, ...preset) {
  const fn = this;
  return function (...later) {
    return fn.apply(ctx, [...preset, ...later]);
  };
};
```

### Q180. Solve Custom bind Polyfill with an optimized approach suitable for large input.

**Answer:**

- Approach: State and justify the complexity clearly in the interview.
- Reference complexity: Time O(1) wrapper

```javascript
Function.prototype.myBind = function (ctx, ...preset) {
  const fn = this;
  return function (...later) {
    return fn.apply(ctx, [...preset, ...later]);
  };
};
```

---

Total Questions: 180
